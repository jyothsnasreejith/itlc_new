import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EventAttendingPoster() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [event, setEvent] = useState(null)
  const [loadingEvent, setLoadingEvent] = useState(true)

  const [userImageSrc, setUserImageSrc] = useState(null)
  const [templateImageSrc, setTemplateImageSrc] = useState(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [finalImageSrc, setFinalImageSrc] = useState(null)
  const [userName, setUserName] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Position and font states for name
  const [textPos, setTextPos] = useState({ x: 100, y: 850 })
  const [textFontSize, setTextFontSize] = useState(114)
  const [textColor, setTextColor] = useState('#000000')
  const [postDescription, setPostDescription] = useState('')

  const [imgPos, setImgPos] = useState({ x: 0, y: 0 })
  const [imgScale, setImgScale] = useState(1)
  const [displayScale, setDisplayScale] = useState(1)

  const userImgRef = useRef(new Image())
  const templateImgRef = useRef(new Image())
  const resultWrapperRef = useRef(null)
  const resultContainerRef = useRef(null)
  const draggingTarget = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const currentHole = useRef(null)

  // Fetch Event Details
  useEffect(() => {
    if (id) {
      fetchEventDetails()
    }
  }, [id])

  async function fetchEventDetails() {
    try {
      setLoadingEvent(true)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (data) {
        setEvent(data)
        if (data.poster_template || data.image) {
          setTemplateImageSrc(data.poster_template || data.image)
        }
      }
    } catch (err) {
      console.error('Error fetching event for poster generator:', err)
    } finally {
      setLoadingEvent(false)
    }
  }

  useEffect(() => {
    if (event) {
      const eventTitle = event.title || 'Event'
      const eventDate = event.date || ''
      const eventTime = event.time ? ` • ${event.time}` : ''
      const eventVenue = event.location || event.venue || 'ITLC Venue'
      const hashtagTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '')
      const nameIntro = userName.trim() ? `I (${userName.trim()}) am` : `I am`

      setPostDescription(
        `${nameIntro} thrilled to announce that I will be attending ${eventTitle}!\n\n📅 Date: ${eventDate}${eventTime}\n📍 Venue: ${eventVenue}\n\nLooking forward to meeting industry leaders and peers.\n\n#ITLC #${hashtagTitle} #IAmAttending #TechLeadership`
      )
    }
  }, [event, userName])

  // Handle image upload
  const handleImageUpload = (e, setter) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (evt) => setter(evt.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Find transparent hole in template PNG
  const findTransparentArea = (img) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0
      let found = false

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = imageData[(y * canvas.width + x) * 4 + 3]
          if (alpha < 128) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
            found = true
          }
        }
      }

      if (!found) return null
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: minX + (maxX - minX) / 2,
        centerY: minY + (maxY - minY) / 2
      }
    } catch (e) {
      return null
    }
  }

  // Start adjusting layout
  const startAdjustment = () => {
    if (!userImageSrc) {
      alert('Please upload your photo first!')
      return
    }
    if (!templateImageSrc) {
      alert('Template image is missing. Please select or upload a template image.')
      return
    }

    userImgRef.current.src = userImageSrc
    templateImgRef.current.onload = () => {
      currentHole.current = findTransparentArea(templateImgRef.current)
    }
    templateImgRef.current.src = templateImageSrc

    setIsAdjusting(true)
    setFinalImageSrc(null)
  }

  useEffect(() => {
    const updateScale = () => {
      if (isAdjusting && templateImgRef.current) {
        const wrapperW = resultWrapperRef.current ? resultWrapperRef.current.offsetWidth : (window.innerWidth - 32)
        const containerWidth = Math.min(Math.max(wrapperW - 24, 260), 600)
        const templateW = templateImgRef.current.width || 600
        const templateH = templateImgRef.current.height || 600
        const userW = userImgRef.current.width || 400
        const userH = userImgRef.current.height || 400

        const dScale = Math.min(1, containerWidth / templateW)
        setDisplayScale(dScale || 0.5)

        if (!imgScale || imgScale === 1) {
          let initialX = 0, initialY = 0, initialScale = 1

          if (currentHole.current) {
            initialScale = Math.max(
              currentHole.current.width / userW,
              currentHole.current.height / userH
            )
            initialX = currentHole.current.centerX - userW / 2
            initialY = currentHole.current.centerY - userH / 2

            setTextPos({
              x: currentHole.current.x + currentHole.current.width / 2 - 100,
              y: currentHole.current.y + currentHole.current.height + 20
            })
          } else {
            initialScale = Math.max(templateW / userW, templateH / userH)
            initialX = (templateW - userW) / 2
            initialY = (templateH - userH) / 2
          }

          setImgScale(initialScale || 1)
          setImgPos({ x: initialX, y: initialY })
        }
      }
    }

    if (isAdjusting) {
      updateScale()
      setTimeout(() => {
        resultWrapperRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    }

    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [isAdjusting])

  const getClientPos = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const handleImageDragStart = (e) => {
    draggingTarget.current = 'image'
    const pos = getClientPos(e)
    startPos.current = { x: pos.x, y: pos.y }
  }

  const handleTextDragStart = (e) => {
    draggingTarget.current = 'text'
    const pos = getClientPos(e)
    startPos.current = { x: pos.x, y: pos.y }
    e.stopPropagation()
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingTarget.current) return
      if (e.cancelable && e.type === 'touchmove') {
        e.preventDefault()
      }
      const pos = getClientPos(e)
      const deltaX = (pos.x - startPos.current.x) / displayScale
      const deltaY = (pos.y - startPos.current.y) / displayScale
      if (draggingTarget.current === 'image') {
        setImgPos((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      } else if (draggingTarget.current === 'text') {
        setTextPos((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      }
      startPos.current = { x: pos.x, y: pos.y }
    }

    const handleMouseUp = () => {
      draggingTarget.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove, { passive: false })
    window.addEventListener('touchend', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [displayScale])

  const generateFinalImage = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const template = templateImgRef.current
    const user = userImgRef.current

    canvas.width = template.width || 1080
    canvas.height = template.height || 1080

    // 1. Draw User Image Layer
    const w = user.width * imgScale
    const h = user.height * imgScale
    const drawX = imgPos.x + user.width / 2 - w / 2
    const drawY = imgPos.y + user.height / 2 - h / 2

    ctx.drawImage(user, drawX, drawY, w, h)

    // 2. Draw Template Layer
    ctx.drawImage(template, 0, 0)

    // 3. Draw Username
    if (userName) {
      ctx.textBaseline = 'top'
      ctx.font = `bold ${textFontSize}px sans-serif`
      ctx.fillStyle = textColor
      ctx.fillText(userName, textPos.x, textPos.y)
    }

    const dataUrl = canvas.toDataURL('image/png')
    setFinalImageSrc(dataUrl)

    setTimeout(() => {
      document.getElementById('final-result-box')?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  const copyShareableLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleDownload = () => {
    if (!finalImageSrc) return
    const link = document.createElement('a')
    link.download = `${(event?.title || 'event').replace(/\s+/g, '-').toLowerCase()}-im-attending.png`
    link.href = finalImageSrc
    link.click()
  }

  const [sharingOnLinkedIn, setSharingOnLinkedIn] = useState(false)
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

  const executeLinkedInShare = async (token, urn) => {
    try {
      setSharingOnLinkedIn(true)
      if (!finalImageSrc) {
        throw new Error('Please generate poster first')
      }

      const shareResponse = await fetch(`${BACKEND_URL}/api/linkedin/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          urn,
          text: postDescription,
          image: finalImageSrc
        })
      })

      if (!shareResponse.ok) {
        const errJson = await shareResponse.json()
        throw new Error(errJson.error || 'Failed to post on LinkedIn')
      }

      alert('Poster & description shared successfully to your LinkedIn feed!')
    } catch (err) {
      console.error('LinkedIn Share Error:', err)
      fallbackLinkedInShare()
    } finally {
      setSharingOnLinkedIn(false)
    }
  }

  const fallbackLinkedInShare = async () => {
    try {
      if (finalImageSrc) {
        const res = await fetch(finalImageSrc)
        const blob = await res.blob()
        const fileName = `${(event?.title || 'event').replace(/\s+/g, '-').toLowerCase()}-im-attending.png`
        const file = new File([blob], fileName, { type: 'image/png' })

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Attending ${event?.title || 'Event'}`,
            text: postDescription,
            files: [file]
          })
          return
        }
      }
    } catch (e) {
      console.log('Web share fallback:', e)
    }

    handleDownload()
    navigator.clipboard.writeText(postDescription)
    alert('Poster image downloaded & description copied to clipboard! Paste text and attach poster on LinkedIn.')
    const text = encodeURIComponent(postDescription)
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${text}`, '_blank')
  }

  const shareToLinkedIn = () => {
    const token = localStorage.getItem('linkedInToken')
    const urn = localStorage.getItem('linkedInUrn')

    if (token && urn) {
      executeLinkedInShare(token, urn)
    } else {
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        `${BACKEND_URL}/api/linkedin/login`,
        'LinkedInLogin',
        `width=${width},height=${height},top=${top},left=${left}`
      )

      if (!popup) {
        fallbackLinkedInShare()
        return
      }

      const messageListener = async (evt) => {
        if (evt.data?.type === 'LINKEDIN_LOGIN_SUCCESS') {
          const { token: newToken, urn: newUrn, name: newName } = evt.data.payload
          localStorage.setItem('linkedInToken', newToken)
          localStorage.setItem('linkedInUrn', newUrn)
          localStorage.setItem('linkedInName', newName)
          window.removeEventListener('message', messageListener)
          await executeLinkedInShare(newToken, newUrn)
        }
      }
      window.addEventListener('message', messageListener)
    }
  }

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-primary">sync</span>
          <span className="text-sm font-medium">Loading event poster generator...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight font-sans">
                "I Am Attending" Poster Generator
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{event?.title || 'ITLC Leadership Meet'}</p>
            </div>
          </div>
          <button
            onClick={copyShareableLink}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-sm">{copiedLink ? 'check' : 'share'}</span>
            <span>{copiedLink ? 'Link Copied!' : 'Share Generator Link'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Banner Card matching ITLC Brand */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-2">
            <span className="inline-block px-3 py-1 bg-white/20 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-full backdrop-blur-xs">
              Official Delegate Badge
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Announce Your Participation at {event?.title || 'Event'}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Create your customized "I Am Attending" poster in seconds! Upload your portrait, position it inside the event template, and share directly to LinkedIn to let your network know.
            </p>
          </div>
        </div>

        {/* Upload & Setup Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Step 1: Your Photo & Name */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-extrabold">1</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Your Photo & Name</h3>
            </div>

            {/* Photo Upload Area */}
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setUserImageSrc)}
                className="hidden"
              />
              <div className="w-full h-44 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {userImageSrc ? (
                  <div className="w-full h-full relative group flex items-center justify-center">
                    <img src={userImageSrc} alt="User Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-slate-900/70 text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      Change Photo
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500">cloud_upload</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Click to Upload Your Photo</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">JPG, PNG, WEBP supported</p>
                  </div>
                )}
              </div>
            </label>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Your Full Name (Display on Poster)</label>
              <input
                type="text"
                placeholder="e.g. Shibin Chulliparambil"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-primary text-slate-900 dark:text-white text-xs rounded-xl px-4 py-3 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Step 2: Template Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-extrabold">2</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Event Poster Template</h3>
              </div>

              {/* Template Preview */}
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={(e) => handleImageUpload(e, setTemplateImageSrc)}
                  className="hidden"
                />
                <div className="w-full h-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-center p-3 relative overflow-hidden group">
                  {templateImageSrc ? (
                    <img src={templateImageSrc} alt="Template Frame" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center text-slate-400 dark:text-slate-500">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <p className="text-xs">No Template Selected</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-slate-900/70 text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    Change Template PNG
                  </div>
                </div>
              </label>
            </div>

            {/* Start Adjustment Button */}
            <button
              onClick={startAdjustment}
              disabled={!userImageSrc || !templateImageSrc}
              className="w-full py-3 px-6 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span className="material-symbols-outlined text-base">crop_rotate</span>
              <span>Position & Customize Poster</span>
            </button>
          </div>
        </div>

        {/* Interactive Canvas Editor Section */}
        {isAdjusting && (
          <div ref={resultWrapperRef} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Adjust Photo & Name Position</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Drag photo or text inside the frame to adjust alignment</p>
              </div>
              <button
                onClick={generateFinalImage}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Generate Final Poster</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Canvas Interactive Container */}
              <div className="lg:col-span-8 flex justify-center bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div
                  ref={resultContainerRef}
                  className="relative select-none touch-none cursor-move overflow-hidden rounded-lg shadow-xl"
                  style={{
                    width: (templateImgRef.current.width || 600) * displayScale,
                    height: (templateImgRef.current.height || 600) * displayScale
                  }}
                  onMouseDown={handleImageDragStart}
                  onTouchStart={handleImageDragStart}
                >
                  {/* User Image Layer */}
                  <img
                    src={userImageSrc}
                    alt="User Layer"
                    className="absolute max-w-none select-none pointer-events-none"
                    style={{
                      width: userImgRef.current.width * imgScale * displayScale,
                      height: userImgRef.current.height * imgScale * displayScale,
                      left: (imgPos.x + userImgRef.current.width / 2 - (userImgRef.current.width * imgScale) / 2) * displayScale,
                      top: (imgPos.y + userImgRef.current.height / 2 - (userImgRef.current.height * imgScale) / 2) * displayScale
                    }}
                  />

                  {/* Template Frame Layer */}
                  <img
                    src={templateImageSrc}
                    alt="Template Overlay"
                    className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  />

                  {/* Name Text Layer */}
                  {userName && (
                    <div
                      onMouseDown={handleTextDragStart}
                      onTouchStart={handleTextDragStart}
                      className="absolute font-bold cursor-grab active:cursor-grabbing border border-dashed border-amber-400/60 p-1 rounded bg-black/30 backdrop-blur-2xs text-white"
                      style={{
                        left: textPos.x * displayScale,
                        top: textPos.y * displayScale,
                        fontSize: `${textFontSize * displayScale}px`,
                        color: textColor
                      }}
                    >
                      {userName}
                    </div>
                  )}
                </div>
              </div>

              {/* Controls Column */}
              <div className="lg:col-span-4 space-y-5 bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Controls</h4>

                {/* Photo Scale Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Photo Scale / Zoom</span>
                    <span className="text-primary font-bold">{Math.round(imgScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="3"
                    step="0.01"
                    value={imgScale}
                    onChange={(e) => setImgScale(parseFloat(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Text Size Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Name Font Size</span>
                    <span className="text-primary font-bold">{textFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="250"
                    step="2"
                    value={textFontSize}
                    onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Text Color Picker */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Name Text Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-mono uppercase">{textColor}</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={generateFinalImage}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>Generate Poster</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Final Result Box */}
        {finalImageSrc && (
          <div id="final-result-box" className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-6 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Your "I Am Attending" Poster is Ready!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Download your poster and share it on LinkedIn to inform your network</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Final Generated Poster Image */}
              <div className="md:col-span-6 flex justify-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <img src={finalImageSrc} alt="Final Poster Result" className="max-h-[480px] w-auto object-contain rounded-lg shadow-lg" />
              </div>

              {/* Action Buttons & LinkedIn Post Text */}
              <div className="md:col-span-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">LinkedIn Post Description</label>
                  <textarea
                    rows={5}
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleDownload}
                    className="py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    <span>Download PNG</span>
                  </button>

                  <button
                    onClick={shareToLinkedIn}
                    disabled={sharingOnLinkedIn}
                    className="py-3 px-4 rounded-xl bg-[#0a66c2] hover:bg-[#084e96] disabled:opacity-60 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {sharingOnLinkedIn ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                        <span>Posting to LinkedIn...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                        <span>Share to LinkedIn</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
