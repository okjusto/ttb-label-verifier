import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  brandName: z.string().trim().max(200),
  classType: z.string().trim().max(200),
  abv: z.string().trim().max(50),
  netContents: z.string().trim().max(100),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpe?g);base64,/, "Image must be a PNG or JPEG data URL")
    .max(15_000_000),
});

export type FieldVerdict = "match" | "mismatch" | "not_found";

export type VerifyLabelResult = {
  overall: "pass" | "needs_review";
  summary: string;
  fields: Array<{
    field: "brandName" | "classType" | "abv" | "netContents";
    label: string;
    submitted: string;
    foundOnLabel: string;
    verdict: FieldVerdict;
    note: string;
  }>;
  observations: string[];
};

const FIELD_LABELS: Record<string, string> = {
  brandName: "Brand Name",
  classType: "Class/Type Designation",
  abv: "Alcohol Content (ABV)",
  netContents: "Net Contents",
};

export const verifyLabel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<VerifyLabelResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured. Please contact your administrator.");

    const systemPrompt = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance assistant. You compare an alcoholic beverage label image against the applicant's submitted application data. Be conservative: only mark a field as "match" when the label clearly shows information consistent with the submitted value. Use "not_found" if you cannot read or locate the information on the label. Use "mismatch" if the label clearly contradicts the submitted value. Provide plain-language, jargon-free notes a non-technical reviewer can understand.`;

    const userText = `Submitted application data:
- Brand Name: ${data.brandName || "(blank)"}
- Class/Type Designation: ${data.classType || "(blank)"}
- Alcohol Content (ABV): ${data.abv || "(blank)"}
- Net Contents: ${data.netContents || "(blank)"}

Examine the attached label image and return a JSON object with this exact shape:
{
  "overall": "pass" | "needs_review",
  "summary": "one short sentence overview",
  "fields": [
    { "field": "brandName", "submitted": "...", "foundOnLabel": "...", "verdict": "match" | "mismatch" | "not_found", "note": "..." },
    { "field": "classType", ... },
    { "field": "abv", ... },
    { "field": "netContents", ... }
  ],
  "observations": ["other notable items on the label, missing mandatory disclosures like 'GOVERNMENT WARNING', etc."]
}
Set overall to "pass" only if every field is "match" and no observations indicate missing mandatory information.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      throw new Error("Too many requests right now. Please wait a moment and try again.");
    }
    if (res.status === 402) {
      throw new Error("AI usage credits are exhausted. Please add credits in Workspace settings.");
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, errText);
      throw new Error("Verification service failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from verification service.");

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Verification service returned an unreadable response.");
    }

    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const normalizedFields: VerifyLabelResult["fields"] = (
      ["brandName", "classType", "abv", "netContents"] as const
    ).map((key) => {
      const raw = fields.find((f: any) => f?.field === key) ?? {};
      const submittedFromInput = data[key];
      const verdict: FieldVerdict =
        raw.verdict === "match" || raw.verdict === "mismatch" || raw.verdict === "not_found"
          ? raw.verdict
          : "not_found";
      return {
        field: key,
        label: FIELD_LABELS[key],
        submitted: String(raw.submitted ?? submittedFromInput ?? ""),
        foundOnLabel: String(raw.foundOnLabel ?? ""),
        verdict,
        note: String(raw.note ?? ""),
      };
    });

    return {
      overall: parsed.overall === "pass" ? "pass" : "needs_review",
      summary: String(parsed.summary ?? ""),
      fields: normalizedFields,
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.map((o: any) => String(o)).filter(Boolean)
        : [],
    };
  });
