export async function uploadVideoToYouTube(
  channelId: string,
  userAccessToken: string,
  videoBlob: Blob,
  title: string,
  description: string,
  tags: string[],
  isShort: boolean
): Promise<{ id: string; permalinkUrl?: string } | { error: { message: string } }> {
  try {
    console.log(`Starting YouTube upload for channel ${channelId}. Size: ${videoBlob.size}, isShort: ${isShort}`)

    // For YouTube Shorts: ensure #Shorts is in title (max 100 chars) and tags
    let uploadTitle = title.substring(0, 100)
    let uploadDescription = description
    let uploadTags = [...tags]

    if (isShort) {
      // YouTube Shorts requires #Shorts in title or description for discovery
      if (!uploadTitle.toLowerCase().includes('#shorts')) {
        const shortsTag = ' #Shorts'
        uploadTitle = (uploadTitle + shortsTag).substring(0, 100)
      }
      if (!uploadDescription.toLowerCase().includes('#shorts')) {
        uploadDescription = uploadDescription + '\n\n#Shorts'
      }
      if (!uploadTags.some(t => t.toLowerCase() === 'shorts')) {
        uploadTags = ['Shorts', ...uploadTags]
      }
    }

    // Limit tags to YouTube API max (500 chars total, max 30 tags)
    uploadTags = uploadTags.slice(0, 30)
    
    // 1. Initiate Resumable Upload
    const initHeaders = new Headers()
    initHeaders.append('Authorization', `Bearer ${userAccessToken}`)
    initHeaders.append('Content-Type', 'application/json; charset=UTF-8')
    initHeaders.append('X-Upload-Content-Length', videoBlob.size.toString())
    initHeaders.append('X-Upload-Content-Type', 'video/mp4')

    const requestBody = {
      snippet: {
        title: uploadTitle,
        description: uploadDescription,
        tags: uploadTags,
        categoryId: '22' // People & Blogs - safe default for both Shorts and regular videos
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    }

    const initUrl = `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
    
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify(requestBody)
    })

    if (!initRes.ok) {
      const errorText = await initRes.text()
      console.error('YouTube Init Error:', initRes.status, errorText)
      return { error: { message: `YouTube Init failed: ${initRes.status} ${errorText}` } }
    }

    const uploadUrl = initRes.headers.get('Location')
    if (!uploadUrl) {
      return { error: { message: 'YouTube API did not return an upload URL' } }
    }

    console.log('Got YouTube upload URL. Starting transfer...')

    // 2. Upload Video Bytes
    const uploadHeaders = new Headers()
    uploadHeaders.append('Authorization', `Bearer ${userAccessToken}`)
    uploadHeaders.append('Content-Type', 'video/mp4')
    // For simplicity, we'll try a single chunk if it's small, or chunks if it's large.
    // Actually, fetch handles large blobs smoothly in Deno.

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: videoBlob
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('YouTube Upload Error:', uploadRes.status, errText)
      return { error: { message: `YouTube Upload failed: ${uploadRes.status} ${errText}` } }
    }

    const result = await uploadRes.json()
    console.log(`YouTube upload completed successfully: ${result.id}`)
    
    return { 
      id: result.id, 
      permalinkUrl: `https://www.youtube.com/watch?v=${result.id}`
    }

  } catch (error) {
    console.error('YouTube upload exception:', error)
    return { error: { message: error instanceof Error ? error.message : 'Unknown YouTube error' } }
  }
}
