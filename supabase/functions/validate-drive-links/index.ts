const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationResult {
  url: string
  fileId: string | null
  valid: boolean
  error?: string
  fileName?: string
  mimeType?: string
  size?: number
}

// ============ Google Drive API Authentication ============

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
  // Handle multiple formats: raw PEM, JSON-escaped \n, double-escaped \\n
  const processed = pem
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
  
  const b64 = processed
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '')
  
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
  return data.access_token
}

function getFileId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

async function validateLink(url: string, accessToken: string): Promise<ValidationResult> {
  const fileId = getFileId(url)
  
  if (!fileId) {
    return { url, fileId: null, valid: false, error: 'Invalid Google Drive URL format' }
  }
  
  try {
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`
    const response = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    if (!response.ok) {
      if (response.status === 404) return { url, fileId, valid: false, error: 'File not found' }
      if (response.status === 403) {
        const serviceEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
        return { url, fileId, valid: false, error: `No permission. Share with: ${serviceEmail}` }
      }
      return { url, fileId, valid: false, error: `API error: ${response.status}` }
    }
    
    const metadata = await response.json()
    return { url, fileId, valid: true, fileName: metadata.name, mimeType: metadata.mimeType, size: metadata.size ? parseInt(metadata.size) : undefined }
  } catch (error) {
    return { url, fileId, valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { links } = await req.json() as { links: string[] }

    if (!links || !Array.isArray(links)) {
      return new Response(JSON.stringify({ error: 'links array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`Validating ${links.length} links via Google Drive API`)
    const accessToken = await getGoogleAccessToken()

    const batchSize = 10
    const results: ValidationResult[] = []

    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(url => validateLink(url, accessToken)))
      results.push(...batchResults)
      if (i + batchSize < links.length) await new Promise(resolve => setTimeout(resolve, 100))
    }

    const validCount = results.filter(r => r.valid).length
    console.log(`Validation complete: ${validCount}/${links.length} valid`)

    return new Response(JSON.stringify({ results, summary: { total: links.length, valid: validCount, invalid: links.length - validCount } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Validation error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
