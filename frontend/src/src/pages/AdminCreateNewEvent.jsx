import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function AdminCreateNewEvent() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    eventName: '',
    description: '',
    date: '',
    time: '',
    location: '',
    address: '',
    maxRegistrations: '',
    fee: '',
    autoShare: true
  })
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('Creating event with data:', formData)
      
      const { data, error } = await supabase
        .from('events')
        .insert([
          {
            title: formData.eventName,
            description: formData.description,
            date: formData.date,
            time: formData.time,
            location: formData.location,
            address: formData.address,
            max_registrations: formData.maxRegistrations ? parseInt(formData.maxRegistrations) : null,
            fee: formData.fee ? parseFloat(formData.fee) : 0,
            auto_share: formData.autoShare,
            status: 'upcoming',
            image: imagePreview || null
          }
        ])
        .select()

      if (error) {
        console.error('Database error:', error)
        if (error.message.includes('RLS') || error.message.includes('permission')) {
          alert('Database permission error. Please disable RLS on events table: ALTER TABLE events DISABLE ROW LEVEL SECURITY;')
        } else {
          alert(`Error: ${error.message}`)
        }
        throw error
      }

      console.log('Event created:', data)
      alert('Event created successfully!')
      navigate('/events')
    } catch (error) {
      console.error('Error creating event:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden max-w-md mx-auto border-x border-slate-200 dark:border-slate-800">
      <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
        <div 
          onClick={() => navigate(-1)}
          className="text-primary flex size-12 shrink-0 items-center justify-start cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>chevron_left</span>
        </div>
        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
          Create New Event
        </h2>
      </div>

      <div className="px-4 py-4">
        <h3 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em] pb-6">
          Event Details
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Event Name
              </p>
              <input
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="e.g. Community Tech Meetup"
                type="text"
                required
              />
            </label>
          </div>

          <div className="w-full">
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
              Event Banner
            </p>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                <img src={imagePreview} alt="Event preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            ) : (
              <label className="relative w-full aspect-video rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-slate-400 dark:text-slate-600" style={{ fontSize: '40px' }}>
                  add_photo_alternate
                </span>
                <p className="text-slate-500 dark:text-slate-500 text-xs">Tap to upload image</p>
              </label>
            )}
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Date
              </p>
              <input
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                type="date"
                required
              />
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Time
              </p>
              <input
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="e.g. 6:00 PM - 10:00 PM"
                type="text"
                required
              />
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Location
              </p>
              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="e.g. Metropolitan Grand Ballroom"
                type="text"
                required
              />
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Address
              </p>
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="e.g. 123 Community Way, Downtown"
                type="text"
                required
              />
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Description
              </p>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[120px] placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal resize-none shadow-sm"
                placeholder="Provide details about the event..."
                required
              />
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Max Registrations
              </p>
              <input
                name="maxRegistrations"
                value={formData.maxRegistrations}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="Leave empty for unlimited registrations"
                type="number"
                min="1"
              />
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                Set a maximum number of registrations. Leave empty for no limit.
              </p>
            </label>
          </div>

          <div className="w-full">
            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                Event Fee (₹)
              </p>
              <input
                name="fee"
                value={formData.fee}
                onChange={handleChange}
                className="form-input flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 text-base font-normal leading-normal shadow-sm"
                placeholder="0 for free event"
                type="number"
                min="0"
                step="0.01"
              />
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                Enter the registration fee in INR. Leave empty or 0 for free events.
              </p>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
            <div className="flex flex-col gap-0.5">
              <p className="text-slate-900 dark:text-slate-100 text-base font-semibold leading-tight">
                Auto-share with members
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Sends an email invitation immediately
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                name="autoShare"
                type="checkbox"
                checked={formData.autoShare}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="pt-4 pb-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Event...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
