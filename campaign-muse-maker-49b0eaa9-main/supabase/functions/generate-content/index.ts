import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface VideoInfo {
  url: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileName?: string;
}

// Extract video thumbnail from Google Drive
async function getVideoThumbnail(fileId: string, accessToken: string): Promise<string | null> {
  try {
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,videoMediaMetadata`;
    const resp = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!resp.ok) return null;
    
    const data = await resp.json();
    if (data.thumbnailLink) {
      // Get higher resolution thumbnail
      const highResThumbnail = data.thumbnailLink.replace('=s220', '=s1000');
      
      // Download and convert to base64
      const thumbResp = await fetch(highResThumbnail);
      if (thumbResp.ok) {
        const blob = await thumbResp.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return base64;
      }
    }
    return null;
  } catch (err) {
    console.error('Error getting thumbnail:', err);
    return null;
  }
}

// Google Drive auth helpers
function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textToBase64Url(text: string): string {
  const encoder = new TextEncoder();
  return base64UrlEncode(encoder.encode(text));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const processed = pem.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  const b64 = processed
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function createSignedJwt(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  const headerB64 = textToBase64Url(JSON.stringify(header));
  const payloadB64 = textToBase64Url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  const jwt = await createSignedJwt(email, privateKey);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  
  if (!response.ok) throw new Error(`Google OAuth error: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

function getFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function getVideoMetadata(fileId: string, accessToken: string): Promise<{
  name: string;
  duration: number;
  width: number;
  height: number;
  thumbnail: string | null;
}> {
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,videoMediaMetadata,thumbnailLink,shortcutDetails,mimeType`;
  const resp = await fetch(metadataUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  
  if (!resp.ok) throw new Error(`Failed to get metadata: ${resp.status}`);
  
  let data = await resp.json();
  
  // Handle shortcuts
  if (data.mimeType === 'application/vnd.google-apps.shortcut' && data.shortcutDetails?.targetId) {
    const targetResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${data.shortcutDetails.targetId}?fields=id,name,videoMediaMetadata,thumbnailLink`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (targetResp.ok) data = await targetResp.json();
  }
  
  const thumbnail = await getVideoThumbnail(data.id || fileId, accessToken);
  
  return {
    name: data.name || 'Unknown',
    duration: data.videoMediaMetadata?.durationMillis ? parseInt(data.videoMediaMetadata.durationMillis) / 1000 : 0,
    width: data.videoMediaMetadata?.width || 0,
    height: data.videoMediaMetadata?.height || 0,
    thumbnail
  };
}

interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  tone: string;
}

interface GeminiFunctionArgs {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  detected_content?: string;
  tone?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: {
          args?: GeminiFunctionArgs;
        };
      }>;
    };
  }>;
}

async function generateVideoAwareCaption(
  description: string,
  videoInfo: { name: string; duration: number; width: number; height: number; thumbnail: string | null },
  index: number,
  total: number,
  geminiApiKey: string
): Promise<GeneratedCaption> {
  const GEMINI_API_KEY = geminiApiKey;
  if (!GEMINI_API_KEY) throw new Error('No Gemini API key available');

  const aspectRatio = videoInfo.width && videoInfo.height 
    ? (videoInfo.width / videoInfo.height).toFixed(2) 
    : 'unknown';
  
  const isVertical = videoInfo.height > videoInfo.width;
  const isReel = videoInfo.duration > 0 && videoInfo.duration <= 90;
  const formatType = isReel ? 'Reel/Short' : 'Long Video';
  
  const styles = ['Hinglish viral style', 'Pure Hindi emotional', 'English Gen-Z', 'Bollywood drama', 'Desi meme energy', 'Motivational Hindi', 'Romantic poetry'];
  const tones = ['excited', 'chill', 'dramatic', 'funny', 'romantic', 'motivational', 'sassy', 'nostalgic'];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];
  const randomTone = tones[Math.floor(Math.random() * tones.length)];

  const systemPrompt = `You are an expert Indian social media caption writer. Analyze the video content and create viral captions.

VIDEO ANALYSIS CONTEXT:
- File name: "${videoInfo.name}" (may contain clues about content)
- Duration: ${videoInfo.duration.toFixed(1)} seconds
- Aspect ratio: ${aspectRatio} (${isVertical ? 'Vertical/Portrait' : 'Horizontal/Landscape'})
- Format: ${formatType}
- Resolution: ${videoInfo.width}x${videoInfo.height}

CAMPAIGN CONTEXT: "${description}"
STYLE: ${randomStyle}
TONE: ${randomTone}

CAPTION RULES:
1. The caption must be structured into components: Hook, Body, and CTA.
2. The Hook must be highly viral (1 sentence).
3. The Body must elaborate on the video content (based on thumbnail/name).
4. Outline EXACTLY 8 relevant hashtags WITHOUT the # symbol.
5. Use trending Indian slang, emojis, and hooks.

Random seed for uniqueness: ${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: `Create caption #${index + 1} of ${total}. Analyze the video thumbnail and metadata to write a ${randomTone} caption in ${randomStyle}.` }
  ];
  
  // Add thumbnail as inline image if available
  if (videoInfo.thumbnail) {
    parts.unshift({
      inline_data: {
        mime_type: 'image/jpeg',
        data: videoInfo.thumbnail
      }
    });
  }

  const requestBody = {
    contents: [
      { role: 'user', parts }
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 1.2,
      topP: 0.95,
      topK: 40,
    },
    tools: [{
      functionDeclarations: [{
        name: 'generate_video_caption',
        description: 'Generate a viral caption based on video analysis',
        parameters: {
          type: 'OBJECT',
          properties: {
            hook: { type: 'STRING', description: 'A scroll-stopping opening hook sentence' },
            body: { type: 'STRING', description: 'Main caption body text exploring the content' },
            cta: { type: 'STRING', description: 'A short call to action sentence (e.g. comment below, share)' },
            hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Exactly 8 hashtags without # symbol' },
            detected_content: { type: 'STRING', description: 'Brief description of what you detected in the video thumbnail' },
            tone: { type: 'STRING', description: 'The detected tone of the content' }
          },
          required: ['hook', 'body', 'cta', 'hashtags', 'tone']
        }
      }]
    }],
    toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['generate_video_caption'] } }
  };

  console.log(`Generating caption ${index + 1}/${total} with Gemini (thumbnail: ${videoInfo.thumbnail ? 'yes' : 'no'})`);

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as GeminiResponse;
  console.log('Gemini response:', JSON.stringify(data).substring(0, 500));

  // Extract function call result
  const candidate = data.candidates?.[0];
  const functionCall = candidate?.content?.parts?.find((p) => p.functionCall)?.functionCall;
  
  if (functionCall?.args) {
    console.log('Detected content:', functionCall.args.detected_content || 'N/A');
      let fullCaption = functionCall.args.hook ? functionCall.args.hook + '\n\n' : '';
      fullCaption += functionCall.args.body ? functionCall.args.body + '\n\n' : `${description} 🔥\n\n`;
      fullCaption += functionCall.args.cta ? functionCall.args.cta : '';
      
      return {
        caption: fullCaption.trim(),
        hashtags: functionCall.args.hashtags || [],
        tone: functionCall.args.tone || randomTone
      };
  }

  // Fallback: try to parse text response
  const textPart = candidate?.content?.parts?.find((p) => p.text)?.text;
  if (textPart) {
    return { caption: textPart.substring(0, 200), hashtags: ['viral', 'trending', 'reels'], tone: randomTone };
  }

  throw new Error('Failed to parse Gemini response');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, videoCount = 1, videoUrls = [], userId: bodyUserId } = await req.json();
    
    if (!description) {
      return new Response(
        JSON.stringify({ error: "Description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user ID from body or Authorization header
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let resolvedUserId = bodyUserId
    if (!resolvedUserId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        resolvedUserId = user?.id
      }
    }

    // Require per-user Gemini key
    let GEMINI_API_KEY: string | null = null
    if (resolvedUserId) {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', resolvedUserId)
        .eq('key_name', 'gemini')
        .single()
      if (keyData?.api_key) {
        GEMINI_API_KEY = keyData.api_key
        console.log(`Using per-user Gemini key for user ${resolvedUserId}`)
      }
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "No Gemini API key found. Please add your key in Settings → API Keys." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccountEmail: string | null = null
    let serviceAccountPrivateKey: string | null = null
    if (resolvedUserId) {
      const { data: googleKeys } = await supabase
        .from('user_api_keys')
        .select('key_name, api_key')
        .eq('user_id', resolvedUserId)
        .in('key_name', ['google_service_account_email', 'google_service_account_private_key'])

      const googleKeyMap = new Map((googleKeys || []).map((row: { key_name: string; api_key: string }) => [row.key_name, row.api_key]))
      serviceAccountEmail = googleKeyMap.get('google_service_account_email') || null
      serviceAccountPrivateKey = googleKeyMap.get('google_service_account_private_key') || null
    }

    console.log("Generating AI content for:", description.substring(0, 100));
    console.log("Video URLs provided:", videoUrls.length);

    let accessToken: string | null = null;
    try {
      if (serviceAccountEmail && serviceAccountPrivateKey) {
        accessToken = await getGoogleAccessToken(serviceAccountEmail, serviceAccountPrivateKey);
      }
    } catch (err) {
      console.log("Could not get Google access token, will generate without thumbnails:", err);
    }

    const captions: GeneratedCaption[] = [];
    const count = Math.min(videoCount, 10);
    
    for (let i = 0; i < count; i++) {
      let videoInfo = { name: `Video ${i + 1}`, duration: 0, width: 0, height: 0, thumbnail: null as string | null };
      
      // Try to get video metadata if URL provided
      if (videoUrls[i] && accessToken) {
        const fileId = getFileId(videoUrls[i]);
        if (fileId) {
          try {
            videoInfo = await getVideoMetadata(fileId, accessToken);
            console.log(`Video ${i + 1} metadata:`, videoInfo.name, `${videoInfo.duration}s`, `${videoInfo.width}x${videoInfo.height}`);
          } catch (err) {
            console.log(`Could not get metadata for video ${i + 1}:`, err);
          }
        }
      }

      try {
        const result = await generateVideoAwareCaption(description, videoInfo, i, count, GEMINI_API_KEY);
        captions.push(result);
      } catch (err) {
        console.error(`Error generating caption ${i + 1}:`, err);
        // Fallback caption
        captions.push({
          caption: `${description} 🔥`,
          hashtags: ['viral', 'trending', 'reels', 'explore'],
          tone: 'excited'
        });
      }

      // Delay between requests to respect rate limits
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log("Generated", captions.length, "unique captions with video analysis");

    return new Response(
      JSON.stringify({ success: true, captions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-content error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
