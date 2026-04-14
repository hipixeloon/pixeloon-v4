const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToBase64Url(text: string): string {
  const encoder = new TextEncoder()
  return base64UrlEncode(encoder.encode(text))
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Handle multiple formats:
  // 1. Raw PEM with actual newlines
  // 2. JSON-escaped \n characters
  // 3. Double-escaped \\n characters
  let processed = pem
    .replace(/\\\\n/g, '\n')  // Double-escaped \\n -> newline
    .replace(/\\n/g, '\n')     // JSON-escaped \n -> newline
  
  // Extract just the base64 content between the markers
  const b64 = processed
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '')  // Remove all whitespace
  
  console.log('Base64 length after processing:', b64.length)
  console.log('First 50 chars:', b64.substring(0, 50))
  
  // Decode base64
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)
  
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function createSignedJwt(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }
  
  const headerB64 = textToBase64Url(JSON.stringify(header))
  const payloadB64 = textToBase64Url(JSON.stringify(payload))
  const unsignedToken = `${headerB64}.${payloadB64}`
  
  const key = await importPrivateKey(privateKey)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken))
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  
  if (!email || !privateKey) {
    throw new Error('Google service account credentials not configured')
  }
  
  console.log('Service account email:', email)
  
  const jwt = await createSignedJwt(email, privateKey)
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', 
      assertion: jwt 
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Google OAuth error:', errorText)
    throw new Error(`Google OAuth error: ${response.status}`)
  }
  
  const data = await response.json()
  console.log('Got Google access token successfully')
  return data.access_token
}

function getFileId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json() as { url: string }
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fileId = getFileId(url)
    if (!fileId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Google Drive URL' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Testing file access for:', fileId)
    
    const accessToken = await getGoogleAccessToken()
    
    const metadataResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`, 
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!metadataResp.ok) {
      const errorData = await metadataResp.json().catch(() => ({}))
      console.log('API error:', metadataResp.status, JSON.stringify(errorData))
      
      const serviceEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
      
      if (metadataResp.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: 'File not found on Google Drive' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (metadataResp.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: `No permission. Share file/folder with: ${serviceEmail}` }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ success: false, error: `API error: ${metadataResp.status}` }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metadata = await metadataResp.json()
    console.log('File metadata:', JSON.stringify(metadata))
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'File accessible via Google Drive API', 
        fileName: metadata.name, 
        mimeType: metadata.mimeType, 
        size: metadata.size ? parseInt(metadata.size) : null 
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Test error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
