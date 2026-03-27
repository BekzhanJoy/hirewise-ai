import { promises as fs } from 'fs'
import path from 'path'
import { randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(_scrypt)

export interface LocalUserRecord {
  id: string
  email: string
  password_hash: string
  full_name: string
  created_at: string
}

export interface LocalProfile {
  id: string
  email: string
  full_name: string
  created_at: string
  updated_at: string
}

export interface LocalUserSettings {
  user_id: string
  auto_save_resumes: boolean
  color_scheme: string
  language: string
  max_storage_mb: number
  created_at: string
  updated_at: string
}

export interface LocalResume {
  id: string
  user_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  extracted_text: string
  stored_name: string
  created_at: string
}

export interface LocalScanResult {
  id: string
  user_id: string
  resume_id: string
  keywords: string[]
  match_score: number
  matched_keywords: string[]
  is_best_match: boolean
  created_at: string
}

export interface LocalDb {
  users: LocalUserRecord[]
  profiles: LocalProfile[]
  user_settings: LocalUserSettings[]
  resumes: LocalResume[]
  scan_results: LocalScanResult[]
}

const DATA_DIR = path.join(process.cwd(), 'local-data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DB_FILE = path.join(DATA_DIR, 'db.json')

const defaultDb = (): LocalDb => ({
  users: [],
  profiles: [],
  user_settings: [],
  resumes: [],
  scan_results: [],
})

export async function ensureLocalStorage() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb(), null, 2), 'utf8')
  }
}

export async function readDb(): Promise<LocalDb> {
  await ensureLocalStorage()
  const raw = await fs.readFile(DB_FILE, 'utf8')
  return JSON.parse(raw) as LocalDb
}

export async function writeDb(db: LocalDb) {
  await ensureLocalStorage()
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

async function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHex] = passwordHash.split(':')
  if (!salt || !storedHex) return false
  const derived = (await scrypt(password, salt, 64)) as Buffer
  const stored = Buffer.from(storedHex, 'hex')
  if (stored.length !== derived.length) return false
  return timingSafeEqual(stored, derived)
}

export function toClientUser(user: Pick<LocalUserRecord, 'id' | 'email' | 'full_name'>) {
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      full_name: user.full_name,
    },
  }
}

export async function createUser(email: string, password: string, fullName: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const db = await readDb()
  if (db.users.some((u) => u.email === normalizedEmail)) {
    throw new Error('User with this email already exists')
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const password_hash = await hashPassword(password)

  const user: LocalUserRecord = {
    id,
    email: normalizedEmail,
    password_hash,
    full_name: fullName.trim(),
    created_at: now,
  }

  const profile: LocalProfile = {
    id,
    email: normalizedEmail,
    full_name: fullName.trim(),
    created_at: now,
    updated_at: now,
  }

  const settings: LocalUserSettings = {
    user_id: id,
    auto_save_resumes: true,
    color_scheme: 'emerald',
    language: 'en',
    max_storage_mb: 500,
    created_at: now,
    updated_at: now,
  }

  db.users.push(user)
  db.profiles.push(profile)
  db.user_settings.push(settings)
  await writeDb(db)

  return toClientUser(user)
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const db = await readDb()
  const user = db.users.find((u) => u.email === normalizedEmail)
  if (!user) throw new Error('Invalid email or password')

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) throw new Error('Invalid email or password')

  return toClientUser(user)
}

export async function getProfile(userId: string) {
  const db = await readDb()
  return db.profiles.find((p) => p.id === userId) || null
}

export async function getSettings(userId: string) {
  const db = await readDb()
  return db.user_settings.find((s) => s.user_id === userId) || null
}

export async function updateAccount(
  userId: string,
  input: {
    email?: string
    full_name?: string
    current_password?: string
    new_password?: string
  }
) {
  const db = await readDb()
  const userIndex = db.users.findIndex((u) => u.id === userId)
  if (userIndex < 0) throw new Error('User not found')

  const profileIndex = db.profiles.findIndex((p) => p.id === userId)
  const user = db.users[userIndex]
  const nextEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : user.email
  const nextFullName = typeof input.full_name === 'string' ? input.full_name.trim() : user.full_name
  const wantsEmailChange = nextEmail && nextEmail !== user.email
  const wantsPasswordChange = Boolean(input.new_password)

  if (!nextEmail) throw new Error('Email is required')
  if (!nextFullName) throw new Error('Full name is required')

  if (wantsEmailChange || wantsPasswordChange) {
    if (!input.current_password) throw new Error('Current password is required to change email or password')
    const valid = await verifyPassword(input.current_password, user.password_hash)
    if (!valid) throw new Error('Current password is incorrect')
  }

  if (wantsEmailChange && db.users.some((u, idx) => idx !== userIndex && u.email === nextEmail)) {
    throw new Error('User with this email already exists')
  }

  if (wantsPasswordChange && (input.new_password || '').length < 6) {
    throw new Error('New password must be at least 6 characters')
  }

  user.email = nextEmail
  user.full_name = nextFullName
  if (wantsPasswordChange) {
    user.password_hash = await hashPassword(String(input.new_password))
  }

  if (profileIndex >= 0) {
    db.profiles[profileIndex] = {
      ...db.profiles[profileIndex],
      email: nextEmail,
      full_name: nextFullName,
      updated_at: new Date().toISOString(),
    }
  }

  await writeDb(db)

  return {
    profile: db.profiles.find((p) => p.id === userId) || null,
    user: toClientUser(user),
  }
}

export async function saveProfileAndSettings(
  userId: string,
  profileInput: Partial<LocalProfile>,
  settingsInput: Partial<LocalUserSettings>
) {
  const db = await readDb()
  const now = new Date().toISOString()

  const profileIndex = db.profiles.findIndex((p) => p.id === userId)
  if (profileIndex >= 0) {
    db.profiles[profileIndex] = {
      ...db.profiles[profileIndex],
      full_name: profileInput.full_name ?? db.profiles[profileIndex].full_name,
      updated_at: now,
    }
  }

  const userIndex = db.users.findIndex((u) => u.id === userId)
  if (userIndex >= 0 && profileInput.full_name) {
    db.users[userIndex].full_name = profileInput.full_name
  }

  const settingsIndex = db.user_settings.findIndex((s) => s.user_id === userId)
  if (settingsIndex >= 0) {
    db.user_settings[settingsIndex] = {
      ...db.user_settings[settingsIndex],
      auto_save_resumes: settingsInput.auto_save_resumes ?? db.user_settings[settingsIndex].auto_save_resumes,
      color_scheme: settingsInput.color_scheme ?? db.user_settings[settingsIndex].color_scheme,
      language: settingsInput.language ?? db.user_settings[settingsIndex].language,
      max_storage_mb: settingsInput.max_storage_mb ?? db.user_settings[settingsIndex].max_storage_mb,
      updated_at: now,
    }
  } else {
    db.user_settings.push({
      user_id: userId,
      auto_save_resumes: settingsInput.auto_save_resumes ?? true,
      color_scheme: settingsInput.color_scheme ?? 'emerald',
      language: settingsInput.language ?? 'en',
      max_storage_mb: settingsInput.max_storage_mb ?? 500,
      created_at: now,
      updated_at: now,
    })
  }

  await writeDb(db)
  return {
    profile: db.profiles.find((p) => p.id === userId) || null,
    settings: db.user_settings.find((s) => s.user_id === userId) || null,
  }
}

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function placeholderExtractedText(fileName: string) {
  return `[Extracted text from ${fileName}]\n\nCandidate Name: Local Candidate\nEmail: candidate@example.com\nPhone: +1 555 123 4567\n\nSummary:\nExperienced specialist with strong communication, organization, and problem-solving skills.\n\nSkills:\nCommunication, Leadership, Teamwork, Project Management, Analytical Thinking`
}

export async function saveResumeFromFile(userId: string, file: File) {
  const db = await readDb()
  const ext = path.extname(file.name) || ''
  const storedName = `${Date.now()}-${randomUUID()}${ext}`
  const userDir = path.join(UPLOADS_DIR, userId)
  await fs.mkdir(userDir, { recursive: true })
  const filePath = path.join(userDir, sanitizeName(storedName))
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  let extractedText = ''
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    extractedText = buffer.toString('utf8')
  } else {
    extractedText = placeholderExtractedText(file.name)
  }

  const resume: LocalResume = {
    id: randomUUID(),
    user_id: userId,
    file_name: file.name,
    file_url: `/api/files/${userId}/${path.basename(filePath)}`,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    extracted_text: extractedText,
    stored_name: path.basename(filePath),
    created_at: new Date().toISOString(),
  }

  db.resumes.push(resume)
  await writeDb(db)
  return resume
}

export async function listResumes(userId: string) {
  const db = await readDb()
  const results = db.resumes
    .filter((r) => r.user_id === userId)
    .map((resume) => {
      const scans = db.scan_results.filter((s) => s.resume_id === resume.id)
      const best_match_score = scans.length ? Math.max(...scans.map((s) => s.match_score)) : undefined
      return { ...resume, best_match_score }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return results
}

export async function deleteResume(userId: string, resumeId: string) {
  const db = await readDb()
  const resume = db.resumes.find((r) => r.id === resumeId && r.user_id === userId)
  if (!resume) throw new Error('Resume not found')

  const filePath = path.join(UPLOADS_DIR, userId, resume.stored_name)
  try {
    await fs.unlink(filePath)
  } catch {
    // ignore missing file
  }

  db.resumes = db.resumes.filter((r) => r.id !== resumeId)
  db.scan_results = db.scan_results.filter((s) => s.resume_id !== resumeId)
  await writeDb(db)
}

export async function scanResumes(userId: string, keywords: string[]) {
  const db = await readDb()
  const resumes = db.resumes.filter((r) => r.user_id === userId)
  if (!resumes.length) return []

  let bestResumeId = ''
  let bestScore = -1

  const batch = resumes.map((resume) => {
    const text = resume.extracted_text || ''
    const matchedKeywords = keywords.filter((keyword) => {
      try {
        return new RegExp(keyword, 'i').test(text)
      } catch {
        return text.toLowerCase().includes(keyword.toLowerCase())
      }
    })
    const score = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 100) : 0
    if (score > bestScore) {
      bestScore = score
      bestResumeId = resume.id
    }
    return { resume, matchedKeywords, score }
  })

  const now = new Date().toISOString()
  const saved: Array<{
    id: string
    resumeId: string
    fileName: string
    fileType: string
    matchScore: number
    matchedKeywords: string[]
    isBestMatch: boolean
  }> = []

  for (const item of batch) {
    const record: LocalScanResult = {
      id: randomUUID(),
      user_id: userId,
      resume_id: item.resume.id,
      keywords,
      match_score: item.score,
      matched_keywords: item.matchedKeywords,
      is_best_match: item.resume.id === bestResumeId,
      created_at: now,
    }
    db.scan_results.push(record)
    saved.push({
      id: record.id,
      resumeId: item.resume.id,
      fileName: item.resume.file_name,
      fileType: item.resume.file_type,
      matchScore: item.score,
      matchedKeywords: item.matchedKeywords,
      isBestMatch: record.is_best_match,
    })
  }

  await writeDb(db)
  saved.sort((a, b) => b.matchScore - a.matchScore)
  return saved
}

export async function getDashboard(userId: string) {
  const db = await readDb()
  const resumes = db.resumes.filter((r) => r.user_id === userId)
  const scans = db.scan_results.filter((s) => s.user_id === userId)

  const recentScans = scans
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((scan) => ({
      ...scan,
      resumes: db.resumes.find((r) => r.id === scan.resume_id)
        ? {
            id: db.resumes.find((r) => r.id === scan.resume_id)!.id,
            file_name: db.resumes.find((r) => r.id === scan.resume_id)!.file_name,
            created_at: db.resumes.find((r) => r.id === scan.resume_id)!.created_at,
          }
        : null,
    }))

  return {
    stats: {
      resumesScanned: resumes.length,
      keywordsMatched: scans.length,
      bestMatches: scans.filter((s) => s.is_best_match).length,
    },
    recentScans,
  }
}

export async function readStoredFile(slug: string[]) {
  const filePath = path.join(UPLOADS_DIR, ...slug)
  const data = await fs.readFile(filePath)
  return data
}
