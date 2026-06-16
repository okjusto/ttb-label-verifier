// TTB Label Verifier — calls Anthropic Claude to read & evaluate a label image.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Body = {
  imageBase64?: string;
  brandName?: string;
  classType?: string;
  abv?: string;
  netContents?: string;
};

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
}

function detectMediaType(b64: string): string {
  const m = b64.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,/i);
  if (m) return m[1].toLowerCase().replace("jpg", "jpeg");
  // sniff from raw base64 magic bytes
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBORw0KGgo")) return "image/png";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

function stripDataUrlPrefix(b64: string): string {
  const i = b64.indexOf("base64,");
  return i >= 0 ? b64.slice(i + "base64,".length) : b64;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY is not configured." });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const { imageBase64, brandName = "", classType = "", abv = "", netContents = "" } = body;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return json(400, { error: "imageBase64 is required." });
  }

  const mediaType = detectMediaType(imageBase64);
  const rawB64 = stripDataUrlPrefix(imageBase64);

  const prompt = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label-compliance reader.

The applicant submitted this application data:
- Brand Name: ${brandName || "(blank)"}
- Class/Type Designation: ${classType || "(blank)"}
- Alcohol Content (ABV): ${abv || "(blank)"}
- Net Contents: ${netContents || "(blank)"}

Examine the attached label image and do BOTH of the following:

1. Extract from the label, exactly as printed:
   - brand name
   - class/type designation
   - alcohol content (ABV)
   - net contents
   - the full government warning text (verbatim, preserving capitalization)

2. Evaluate the government warning for compliance:
   (a) exactWordingPresent: true ONLY if the mandatory TTB wording appears word-for-word. The exact mandatory text is:
       "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
   (b) isAllCaps: true if the literal phrase "GOVERNMENT WARNING:" appears in all uppercase letters on the label.
   (c) isBold: true if the "GOVERNMENT WARNING:" phrase appears in bold typeface on the label.

Also report imageQuality as "good", "poor", or "unreadable".

Return ONLY a JSON object (no prose, no markdown code fences) with EXACTLY this shape:
{
  "extracted": {
    "brandName": "string",
    "classType": "string",
    "abv": "string",
    "netContents": "string",
    "warningText": "string"
  },
  "warningChecks": {
    "exactWordingPresent": true,
    "isAllCaps": true,
    "isBold": true
  },
  "imageQuality": "good"
}

If a field cannot be read from the label, use an empty string. If imageQuality is "unreadable", still return the JSON with empty strings and false checks.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: rawB64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    const aborted = (err as Error)?.name === "AbortError";
    console.error("Anthropic request failed:", err);
    return json(aborted ? 504 : 502, {
      error: aborted
        ? "The verification service timed out. Please try again."
        : "Could not reach the verification service.",
    });
  }
  clearTimeout(timeout);

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error", anthropicRes.status, errText);
    if (anthropicRes.status === 400) {
      return json(400, { error: "The image could not be processed. Please upload a clear JPG or PNG." });
    }
    if (anthropicRes.status === 401 || anthropicRes.status === 403) {
      return json(500, { error: "Verification service is not authorized. Please contact the administrator." });
    }
    if (anthropicRes.status === 429) {
      return json(429, { error: "Too many requests. Please wait a moment and try again." });
    }
    return json(502, { error: "Verification service error. Please try again." });
  }

  const payload = (await anthropicRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text) return json(502, { error: "Empty response from verification service." });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch (err) {
    console.error("Failed to parse Claude JSON:", err, text);
    return json(502, { error: "Verification service returned an unreadable response." });
  }

  return json(200, parsed);
});
