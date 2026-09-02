import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { QRCodeCanvas } from 'qrcode.react'
import { getImageUrl } from '../utils/config'

export default function MemberProfileActivityLog() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [activities, setActivities] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [editHistory, setEditHistory] = useState([])
  const [membershipDuration, setMembershipDuration] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedMember, setEditedMember] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [customLogo, setCustomLogo] = useState('')
  const [memberNumber, setMemberNumber] = useState('')
  const idCardRef = useRef(null)

  useEffect(() => {
    fetchMemberProfile()
    // Load custom logo from localStorage
    const savedLogo = localStorage.getItem('customLogo')
    if (savedLogo) setCustomLogo(savedLogo)
  }, [id])

  useEffect(() => {
    // Reset image error state when member changes
    setImageLoadError(false)
  }, [member?.profile_image])

  async function fetchMemberProfile() {
    try {
      // Fetch member data
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single()

      if (memberError) throw memberError
      setMember(memberData)

      // Generate member number based on creation order
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, created_at')
        .order('created_at', { ascending: true })
      
      if (allMembers) {
        const memberIndex = allMembers.findIndex(m => m.id === id)
        if (memberIndex !== -1) {
          const paddedNumber = String(memberIndex + 1).padStart(4, '0')
          setMemberNumber(`ITLC${paddedNumber}`)
        }
      }

      // Calculate membership duration
      const joinedDate = new Date(memberData.created_at)
      const now = new Date()
      const diffTime = Math.abs(now - joinedDate)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const years = Math.floor(diffDays / 365)
      const months = Math.floor((diffDays % 365) / 30)
      
      if (years > 0) {
        setMembershipDuration(`${years}.${months} Yrs`)
      } else {
        setMembershipDuration(`${months} Mos`)
      }

      // Fetch activity log (event attendance)
      const { data: activityData, error: activityError } = await supabase
        .from('event_attendance')
        .select(`
          *,
          event:event_id (*)
        `)
        .eq('member_id', id)
        .order('checked_in_at', { ascending: false })

      if (activityError) throw activityError
      setActivities(activityData || [])

      // Fetch event registrations
      const { data: registrationData, error: registrationError } = await supabase
        .from('event_registrations')
        .select(`
          *,
          event:event_id (*)
        `)
        .eq('member_id', id)
        .order('created_at', { ascending: false })

      if (registrationError) throw registrationError
      setRegistrations(registrationData || [])

      // Fetch edit history
      const { data: historyData, error: historyError } = await supabase
        .from('member_edit_history')
        .select('*')
        .eq('member_id', id)
        .order('changed_at', { ascending: false })

      if (historyError) {
        console.error('Error fetching edit history:', historyError)
      } else {
        setEditHistory(historyData || [])
      }
    } catch (error) {
      console.error('Error fetching member profile:', error)
      // Set demo data
      setMember({
        id: id,
        full_name: 'Alex Johnson',
        designation: 'Sustainable Design',
        area_of_expertise: 'Urban Planning',
        created_at: '2021-03-12',
        membership_tier: 'Gold Tier Member'
      })
      setActivities([
        {
          id: 1,
          type: 'event',
          title: 'Attended Tech Summit 2024',
          location: 'San Francisco',
          date: '2 days ago',
          status: 'Present'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function downloadIdCard() {
    if (!idCardRef.current) return
    
    setDownloading(true)
    try {
      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(idCardRef.current, {
        scale: 3,
        backgroundColor: null, // Transparent to capture padding
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        imageTimeout: 0,
        windowWidth: idCardRef.current.scrollWidth,
        windowHeight: idCardRef.current.scrollHeight
      })
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      
      // Calculate dimensions based on actual card aspect ratio
      const cardWidth = 85.6 // Standard ID card width in mm
      const aspectRatio = canvas.height / canvas.width
      const cardHeight = cardWidth * aspectRatio
      
      const pdf = new jsPDF({
        orientation: cardHeight > cardWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [cardWidth, cardHeight]
      })
      
      pdf.addImage(imgData, 'PNG', 0, 0, cardWidth, cardHeight, '', 'FAST')
      pdf.save(`${member?.full_name?.replace(/\s+/g, '_')}_ID_Card.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleSaveProfile() {
    if (!editedMember) return
    
    setSaving(true)
    try {
      let profileImageUrl = editedMember.profile_image

      // Upload new photo if selected
      if (selectedPhoto) {
        setUploadingPhoto(true)
        const fileExt = selectedPhoto.name.split('.').pop()
        const fileName = `${id}-${Date.now()}.${fileExt}`
        const filePath = `profile-photos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(filePath, selectedPhoto, {
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('member-photos')
          .getPublicUrl(filePath)

        profileImageUrl = publicUrl
        setUploadingPhoto(false)
      }

      // Track changes for edit history
      const changedFields = []
      const fieldsToTrack = [
        'full_name',
        'designation',
        'area_of_expertise',
        'phone_number',
        'professional_phone',
        'personal_phone',
        'email',
        'professional_email',
        'personal_email',
        'company',
        'location'
      ]

      fieldsToTrack.forEach(field => {
        const oldValue = member[field] || ''
        const newValue = editedMember[field] || ''
        if (oldValue !== newValue) {
          changedFields.push({
            member_id: id,
            field_name: field,
            old_value: oldValue,
            new_value: newValue,
            changed_by: id, // Self-edit
            changed_at: new Date().toISOString()
          })
        }
      })

      // Track profile image change if photo was uploaded
      if (selectedPhoto && member.profile_image !== profileImageUrl) {
        changedFields.push({
          member_id: id,
          field_name: 'profile_image',
          old_value: member.profile_image || 'No image',
          new_value: 'Updated',
          changed_by: id,
          changed_at: new Date().toISOString()
        })
      }
      
      const proEmail = editedMember.professional_email || editedMember.email
      const proPhone = editedMember.professional_phone || editedMember.phone_number

      // Update member profile
      const { error } = await supabase
        .from('members')
        .update({
          full_name: editedMember.full_name,
          designation: editedMember.designation,
          area_of_expertise: editedMember.area_of_expertise,
          phone_number: proPhone,
          professional_phone: proPhone,
          personal_phone: editedMember.personal_phone || null,
          email: proEmail,
          professional_email: proEmail,
          personal_email: editedMember.personal_email || null,
          company: editedMember.company,
          location: editedMember.location,
          profile_image: profileImageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      // Save edit history if there were changes
      if (changedFields.length > 0) {
        const { error: historyError } = await supabase
          .from('member_edit_history')
          .insert(changedFields)

        if (historyError) {
          console.error('Error saving edit history:', historyError)
          // Don't fail the whole operation if history logging fails
        }
      }
      
      const updatedMember = { ...editedMember, profile_image: profileImageUrl }
      setMember(updatedMember)
      setIsEditing(false)
      setSelectedPhoto(null)
      setPhotoPreview(null)
      setImageLoadError(false)
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
      setUploadingPhoto(false)
    }
  }

  function handleEditClick() {
    setEditedMember({ ...member })
    setIsEditing(true)
  }

  function handleCancelEdit() {
    setEditedMember(null)
    setIsEditing(false)
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setImageLoadError(false)
  }

  function handleInputChange(field, value) {
    setEditedMember(prev => ({
      ...prev,
      [field]: value
    }))
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      setSelectedPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <h1 className="text-lg font-bold tracking-tight">Member Profile</h1>
          <button className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Profile Header */}
        <div className="px-4 pt-6 pb-4 flex flex-col items-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-primary/20 p-1">
              {photoPreview ? (
                <img 
                  src={photoPreview} 
                  alt="Preview"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : member?.profile_image && !imageLoadError ? (
                <img 
                  src={getImageUrl(member.profile_image)} 
                  alt={member.full_name}
                  className="w-full h-full rounded-full object-cover"
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-cover bg-center bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                </div>
              )}
            </div>
            {isEditing ? (
              <label className="absolute bottom-1 right-1 bg-primary hover:bg-primary/90 text-white p-2 rounded-full border-2 border-white dark:border-slate-800 cursor-pointer transition-colors shadow-lg">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-sm">photo_camera</span>
              </label>
            ) : (
              <div className="absolute bottom-1 right-1 bg-primary text-white p-1.5 rounded-full border-2 border-background-dark">
                <span className="material-symbols-outlined text-sm">verified</span>
              </div>
            )}
          </div>
          {isEditing && selectedPhoto && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              ✓ New photo selected: {selectedPhoto.name}
            </p>
          )}
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-bold">{member?.full_name}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Member ID: <span className="text-primary">{memberNumber}</span>
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-2xl font-bold">{activities.length}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Attended</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-2xl font-bold">{registrations.length}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Registered</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-xl font-bold">{membershipDuration || '0'}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Member</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-4 py-2">
          {!isEditing ? (
            <>
              <button 
                onClick={handleEditClick}
                className="flex-1 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined">edit</span>
                Edit Profile
              </button>
              <button className="bg-slate-100 dark:bg-slate-800 font-bold p-3 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <span className="material-symbols-outlined">qr_code_2</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">{saving ? 'hourglass_empty' : 'save'}</span>
                {uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Member ID Card Section */}
        <section className="mt-8 px-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Member ID Card
            </h3>
            <button
              onClick={downloadIdCard}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">{downloading ? 'downloading' : 'file_download'}</span>
              {downloading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>

          {/* ID Card */}
          <div className="max-w-sm mx-auto">
            <div ref={idCardRef} className="bg-transparent p-8">
              <div className="bg-white dark:bg-slate-800 rounded-[20px] shadow-2xl overflow-hidden relative">
                {/* Card Header */}
                <div className="px-4 py-3 flex justify-between items-center">
                  <div className="text-slate-900 dark:text-white text-sm font-semibold">
                    IT Leaders Community
                  </div>
                  <div className="border border-dashed border-slate-400 dark:border-slate-600 px-3 py-1.5 rounded-lg overflow-hidden">
                    {customLogo ? (
                      <img src={customLogo} alt="Logo" className="h-6 w-auto object-contain" />
                    ) : (
                      <img src="/itlc-logo.svg" alt="ITLC Logo" className="h-6 w-auto object-contain" />
                    )}
                  </div>
                </div>

                {/* Card Middle (Gray Background) */}
                <div className="bg-slate-300 dark:bg-slate-700 h-40 relative">
                  {/* Profile Picture Overlapping - Positioned at bottom center of gray section */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-36 h-36 rounded-full border-8 border-white dark:border-slate-800 overflow-hidden bg-slate-200 dark:bg-slate-600 shadow-lg z-10">
                    {member?.profile_image && !imageLoadError ? (
                      <img 
                        src={getImageUrl(member.profile_image)} 
                        alt={member.full_name}
                        className="w-full h-full object-cover"
                        onError={() => setImageLoadError(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-center bg-cover bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-slate-400 dark:text-slate-500">person</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 pt-20 pb-6 relative bg-white dark:bg-slate-800">
                  <div className="text-center pr-24">
                    <div className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                      {member?.designation || 'Member'}
                    </div>
                    <div className="text-green-700 dark:text-green-500 text-lg font-bold uppercase tracking-wide">
                      {member?.full_name}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                      ID: {memberNumber}
                    </div>
                  </div>

                  {/* QR Code - Bottom Right */}
                  <div className="absolute right-4 bottom-6 w-20 h-20 bg-white border border-slate-300 dark:border-slate-600 flex items-center justify-center rounded p-1.5">
                    <QRCodeCanvas 
                      value={`${window.location.origin}/member/${member?.id}`}
                      size={64}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Info Section */}
        <section className="mt-8">
          <h3 className="px-4 text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            {isEditing ? 'Edit Profile' : 'Expertise & Info'}
          </h3>
          <div className="bg-slate-100 dark:bg-slate-800/30 mx-4 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
              {isEditing ? (
                <>
                  {/* Edit Mode */}
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={editedMember?.full_name || ''}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Designation</label>
                    <input
                      type="text"
                      value={editedMember?.designation || ''}
                      onChange={(e) => handleInputChange('designation', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Expertise Area</label>
                    <input
                      type="text"
                      value={editedMember?.area_of_expertise || ''}
                      onChange={(e) => handleInputChange('area_of_expertise', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Company</label>
                    <input
                      type="text"
                      value={editedMember?.company || ''}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Professional/Work Phone *</label>
                    <input
                      type="tel"
                      value={editedMember?.professional_phone || editedMember?.phone_number || ''}
                      onChange={(e) => {
                        handleInputChange('phone_number', e.target.value)
                        handleInputChange('professional_phone', e.target.value)
                      }}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Personal Phone</label>
                    <input
                      type="tel"
                      value={editedMember?.personal_phone || ''}
                      onChange={(e) => handleInputChange('personal_phone', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="+919876543210"
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Professional/Work Email *</label>
                    <input
                      type="email"
                      value={editedMember?.professional_email || editedMember?.email || ''}
                      onChange={(e) => {
                        handleInputChange('email', e.target.value)
                        handleInputChange('professional_email', e.target.value)
                      }}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="work@company.com"
                      required
                    />
                  </div>
                  <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 pb-3">
                    <label className="text-slate-500 text-sm mb-1">Personal Email</label>
                    <input
                      type="email"
                      value={editedMember?.personal_email || ''}
                      onChange={(e) => handleInputChange('personal_email', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="personal@example.com"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-slate-500 text-sm mb-1">Location</label>
                    <input
                      type="text"
                      value={editedMember?.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* View Mode */}
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Expertise Area</span>
                    <span className="font-semibold">{member?.area_of_expertise || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Designation</span>
                    <span className="font-semibold">{member?.designation || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Company</span>
                    <span className="font-semibold">{member?.company || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Professional/Work Email</span>
                    <span className="font-semibold text-sm">{member?.professional_email || member?.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Personal Email</span>
                    <span className="font-semibold text-sm">{member?.personal_email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Professional/Work Phone</span>
                    <span className="font-semibold">{member?.professional_phone || member?.phone_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Personal Phone</span>
                    <span className="font-semibold">{member?.personal_phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-slate-500">Location</span>
                    <span className="font-semibold">{member?.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Joined Date</span>
                    <span className="font-semibold">
                      {new Date(member?.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        timeZone: 'Asia/Kolkata' 
                      })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Event Registrations */}
        <section className="mt-8">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Event Registrations ({registrations.length})
            </h3>
          </div>
          <div className="px-4 space-y-3">
            {registrations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No event registrations yet</div>
            ) : (
              registrations.map((registration) => {
                const isAttended = activities.some(a => a.event_id === registration.event_id)
                const statusConfig = {
                  approved: { label: 'Approved', color: 'green', icon: 'check_circle' },
                  pending: { label: 'Pending', color: 'yellow', icon: 'schedule' },
                  rejected: { label: 'Declined', color: 'red', icon: 'cancel' }
                }
                const config = statusConfig[registration.status] || statusConfig.pending
                
                return (
                  <div key={registration.id} className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <div className="flex gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/10 flex items-center justify-center text-${config.color}-500 shrink-0`}>
                        <span className="material-symbols-outlined">{config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">{registration.event?.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="material-symbols-outlined text-xs align-middle">location_on</span>
                          {registration.event?.location}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="material-symbols-outlined text-xs align-middle">calendar_today</span>
                          {registration.event?.date} • {registration.event?.time}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <div className={`px-2 py-0.5 bg-${config.color}-500/10 text-${config.color}-500 text-[10px] font-bold rounded uppercase`}>
                            {config.label}
                          </div>
                          {isAttended && (
                            <div className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">check</span>
                              Attended
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Attendance History */}
        <section className="mt-8">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Attendance History ({activities.length})
            </h3>
          </div>
          <div className="px-4 space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No attendance records yet</div>
            ) : (
              activities.map((activity, index) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                      <span className="material-symbols-outlined">event_available</span>
                    </div>
                    {index < activities.length - 1 && (
                      <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-2"></div>
                    )}
                  </div>
                  <div className="pb-6">
                    <p className="font-bold">{activity.event?.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="material-symbols-outlined text-xs align-middle">location_on</span>
                      {activity.event?.location}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="material-symbols-outlined text-xs align-middle">schedule</span>
                      Checked in: {new Date(activity.checked_in_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </p>
                    <div className="mt-2 px-2.5 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded w-fit uppercase">
                      ✓ Attended
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Edit History */}
        <section className="mt-8 mb-24">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              Edit History ({editHistory.length})
            </h3>
          </div>
          <div className="px-4 space-y-4">
            {editHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No edit history yet</div>
            ) : (
              editHistory.map((history, index) => {
                const fieldLabels = {
                  full_name: 'Full Name',
                  designation: 'Designation',
                  area_of_expertise: 'Expertise Area',
                  phone_number: 'Phone Number',
                  email: 'Email',
                  company: 'Company',
                  location: 'Location',
                  profile_image: 'Profile Image'
                }
                
                return (
                  <div key={history.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </div>
                      {index < editHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-2"></div>
                      )}
                    </div>
                    <div className="pb-6 flex-1">
                      <p className="font-bold text-sm">{fieldLabels[history.field_name] || history.field_name}</p>
                      <div className="mt-2 bg-slate-100 dark:bg-slate-800/30 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">From:</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 flex-1">{history.old_value || '(empty)'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">To:</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 font-semibold">{history.new_value || '(empty)'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className="material-symbols-outlined text-xs align-middle">schedule</span>
                        {new Date(history.changed_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata'
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
