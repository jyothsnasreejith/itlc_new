import fs from 'fs'
import path from 'path'
import { supabase } from './src/lib/supabase.js'

// Load .env.local file if it exists
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}


// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    
    // Split CSV while respecting quoted fields
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    
    headers.forEach((header, index) => {
      let value = values[index] || ''
      
      // Handle scientific notation in Excel exports
      if (value.match(/^\d+\.\d+E\+\d+$/)) {
        value = Math.round(parseFloat(value)).toString()
      }
      
      row[header] = value === '' ? null : value
    })
    
    rows.push(row)
  }
  
  return rows
}

// Map CSV columns to database columns
function mapMemberData(csvRow, index) {
  // Generate a unique identifier for members without email
  // This is important since email is unique but may be null
  const hasEmail = csvRow.email && csvRow.email.trim() !== ''
  const hasPhone = csvRow.phone_number && csvRow.phone_number.trim() !== ''
  
  return {
    // Don't include id if it's empty - let Supabase generate it
    ...(csvRow.id ? { id: csvRow.id } : {}),
    salutation: csvRow.salutation || null,
    full_name: csvRow.full_name,
    phone_number: hasPhone ? csvRow.phone_number : null,
    email: hasEmail ? csvRow.email : null,
    designation: csvRow.designation || null,
    company: csvRow.company || null,
    industry_sector: csvRow.industry_sector || null,
    industry_type: csvRow.industry_type || null,
    industry_category: csvRow.industry_category || null,
    industry_sub_category: csvRow.industry_sub_category || null,
    country_of_work: csvRow.country_of_work || null,
    location: csvRow.location || null,
    itlc_chapter_name: csvRow.itlc_chapter_name || null,
    years_of_experience: csvRow.years_of_experience || null,
    date_of_birth: csvRow.date_of_birth || null,
    area_of_expertise: csvRow.area_of_expertise || null,
    profile_image: csvRow.profile_image || null,
    membership_tier: csvRow.membership_tier || 'Standard',
    status: csvRow.status || 'pending',
    created_at: csvRow.created_at || new Date().toISOString(),
    updated_at: csvRow.updated_at || new Date().toISOString(),
  }
}

// Import members with error handling
async function importMembers() {
  try {
    console.log('📖 Reading CSV file...')
    const csvPath = path.join(process.cwd(), 'members_rows.csv')
    const members = parseCSV(csvPath)
    
    console.log(`📊 Found ${members.length} members to import`)
    
    // Map CSV data to database schema
    const mappedMembers = members.map(mapMemberData)
    
    // Insert in batches to avoid timeouts
    const batchSize = 50
    let successCount = 0
    let duplicateCount = 0
    let errorCount = 0
    const errors = []
    
    for (let i = 0; i < mappedMembers.length; i += batchSize) {
      const batch = mappedMembers.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(mappedMembers.length / batchSize)
      
      console.log(`\n🔄 Importing batch ${batchNum}/${totalBatches} (${batch.length} members)...`)
      
      // Use insert instead of upsert
      const { data, error } = await supabase
        .from('members')
        .insert(batch)
        .select()
      
      if (error) {
        console.error(`⚠️  Batch ${batchNum} encountered issues:`, error.message)
        
        // Try inserting individually to identify duplicates
        for (const member of batch) {
          const { error: singleError } = await supabase
            .from('members')
            .insert([member])
          
          if (singleError) {
            if (singleError.message.includes('duplicate') || singleError.code === '23505') {
              duplicateCount++
              console.log(`  ⏭️  Skipped (duplicate): ${member.full_name}`)
            } else {
              errorCount++
              errors.push({
                member: member.full_name,
                error: singleError.message
              })
              console.log(`  ❌ Error: ${member.full_name} - ${singleError.message}`)
            }
          } else {
            successCount++
          }
        }
      } else {
        successCount += batch.length
        console.log(`✅ Batch ${batchNum} successful (${batch.length} members)`)
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📈 IMPORT SUMMARY')
    console.log('='.repeat(50))
    console.log(`✅ Successfully imported: ${successCount} members`)
    if (duplicateCount > 0) {
      console.log(`⏭️  Skipped (duplicates): ${duplicateCount} members`)
    }
    if (errorCount > 0) {
      console.log(`❌ Failed to import: ${errorCount} members`)
      if (errors.length > 0) {
        console.log('\nSample errors:')
        errors.slice(0, 5).forEach(e => {
          console.log(`  - ${e.member}: ${e.error}`)
        })
      }
    }
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error.message)
    process.exit(1)
  }
}

// Run import
importMembers()
