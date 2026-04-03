export async function uploadVideoToInstagram(
  supabase: any,
  igAccountId: string,
  userAccessToken: string,
  videoBlob: Blob,
  caption: string,
  videoId: string
): Promise<{ id: string; permalinkUrl?: string } | { error: { message: string } }> {
  try {
    console.log(`Starting Instagram upload for ${igAccountId}. Step 1: Storing temporarily...`)
    
    // 1. Upload to Supabase temp-videos bucket
    const fileName = `ig_${igAccountId}_${videoId}_${Date.now()}.mp4`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('temp-videos')
      .upload(fileName, videoBlob, {
        contentType: 'video/mp4',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase temp storage error:', uploadError)
      return { error: { message: 'Failed to upload to temp storage: ' + uploadError.message } }
    }

    // 2. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('temp-videos')
      .getPublicUrl(fileName)

    console.log('Got public URL for Instagram:', publicUrl)

    // 3. Initiate Instagram Reels Upload
    console.log('Step 2: Initiating IG Media Upload...')
    const mediaUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media`
    const initRes = await fetch(mediaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: publicUrl,
        caption: caption,
        share_to_feed: true,
        access_token: userAccessToken
      })
    })

    const initJson = await initRes.json()
    if (initJson.error || !initJson.id) {
      console.error('IG Init Error:', initJson.error)
      // Cleanup bucket
      await supabase.storage.from('temp-videos').remove([fileName])
      return { error: { message: initJson.error?.message || 'Failed to initialize IG media' } }
    }

    const creationId = initJson.id
    console.log('IG Media initialized with creation ID:', creationId)

    // 4. Poll for status (wait until FINISHED)
    console.log('Step 3: Polling for FINISHED status...')
    let isFinished = false
    let attempt = 0
    const maxAttempts = 15 // wait up to 75 seconds (15 * 5s)
    
    while (!isFinished && attempt < maxAttempts) {
      attempt++
      await new Promise(resolve => setTimeout(resolve, 5000)) // wait 5 seconds
      
      const statusRes = await fetch(`https://graph.facebook.com/v18.0/${creationId}?fields=status_code&access_token=${userAccessToken}`)
      const statusJson = await statusRes.json()
      
      console.log(`Poll ${attempt}: Status = ${statusJson.status_code}`)
      
      if (statusJson.status_code === 'FINISHED') {
        isFinished = true
      } else if (statusJson.status_code === 'ERROR' || statusJson.error) {
        // Cleanup bucket
        await supabase.storage.from('temp-videos').remove([fileName])
        return { error: { message: 'IG Media processing failed: ' + (statusJson.error?.message || 'Unknown processing error') } }
      }
    }

    if (!isFinished) {
      await supabase.storage.from('temp-videos').remove([fileName])
      return { error: { message: 'Timed out waiting for IG media processing to finish.' } }
    }

    // 5. Publish Media
    console.log('Step 4: Publishing IG Media...')
    const publishUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: userAccessToken
      })
    })

    const publishJson = await publishRes.json()
    
    // Cleanup bucket regardless of success
    await supabase.storage.from('temp-videos').remove([fileName])

    if (publishJson.error || !publishJson.id) {
      console.error('IG Publish Error:', publishJson.error)
      return { error: { message: publishJson.error?.message || 'Failed to publish IG media' } }
    }

    // 6. Get permalink
    let permalinkUrl = undefined
    try {
      const verifyRes = await fetch(`https://graph.facebook.com/v18.0/${publishJson.id}?fields=permalink&access_token=${userAccessToken}`)
      const verifyJson = await verifyRes.json()
      if (verifyJson.permalink) {
        permalinkUrl = verifyJson.permalink
      }
    } catch(e) {
      console.log('Failed to fetch IG permalink (non-fatal):', String(e))
    }

    console.log(`Instagram upload completed successfully: ${publishJson.id}`)
    return { id: publishJson.id, permalinkUrl }
    
  } catch (error) {
    console.error('Instagram upload exception:', error)
    return { error: { message: error instanceof Error ? error.message : 'Unknown Instagram error' } }
  }
}
