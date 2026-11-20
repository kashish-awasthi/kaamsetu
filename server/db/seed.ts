import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db.js'
import { CITIES } from '../src/constants.js'

/** Seedable PRNG so every seed run produces the same data. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(7)
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
const sample = <T>(arr: readonly T[], n: number): T[] => [...arr].sort(() => rand() - 0.5).slice(0, n)

const ROLES: Record<string, { titles: string[]; skills: string[]; pay: [number, number] }> = {
  delivery: { titles: ['Delivery Partner', 'Food Delivery Executive', 'Parcel Delivery Boy/Girl', 'Last-Mile Delivery Rider'], skills: ['two-wheeler', 'driving licence', 'smartphone', 'route knowledge'], pay: [14000, 28000] },
  driver: { titles: ['Car Driver', 'Cab Driver', 'Truck Driver', 'Tempo Driver', 'Personal Driver'], skills: ['driving licence', 'four-wheeler', 'route knowledge', 'commercial licence'], pay: [16000, 32000] },
  warehouse: { titles: ['Warehouse Associate', 'Picker Packer', 'Loader', 'Inventory Helper', 'Forklift Operator'], skills: ['packing', 'inventory', 'forklift', 'scanner'], pay: [12000, 24000] },
  security: { titles: ['Security Guard', 'Bouncer', 'Security Supervisor', 'Gatekeeper'], skills: ['security training', 'night shift', 'cctv'], pay: [12000, 22000] },
  electrician: { titles: ['Electrician', 'Electrical Technician', 'AC Technician', 'Maintenance Electrician'], skills: ['wiring', 'iti electrician', 'ac repair', 'troubleshooting'], pay: [15000, 30000] },
  plumber: { titles: ['Plumber', 'Plumbing Technician', 'Pipe Fitter'], skills: ['pipe fitting', 'iti plumber', 'troubleshooting'], pay: [14000, 26000] },
  housekeeping: { titles: ['Housekeeping Staff', 'Office Boy', 'Cleaner', 'Room Attendant'], skills: ['cleaning', 'housekeeping'], pay: [10000, 18000] },
  cook: { titles: ['Cook', 'Kitchen Helper', 'Chef (North Indian)', 'Tandoor Cook', 'Commis Chef'], skills: ['cooking', 'north indian', 'south indian', 'tandoor'], pay: [12000, 30000] },
  retail: { titles: ['Store Assistant', 'Sales Associate', 'Cashier', 'Store Helper'], skills: ['billing', 'customer service', 'hindi', 'english'], pay: [12000, 22000] },
  telecaller: { titles: ['Telecaller', 'Customer Support Executive', 'Field Sales Executive'], skills: ['hindi', 'english', 'customer service', 'computer basics'], pay: [13000, 25000] },
  construction: { titles: ['Mason', 'Construction Helper', 'Carpenter', 'Painter', 'Welder'], skills: ['masonry', 'carpentry', 'painting', 'welding'], pay: [13000, 27000] },
  factory: { titles: ['Machine Operator', 'Production Helper', 'Quality Checker', 'CNC Operator'], skills: ['machine operation', 'iti fitter', 'quality check', 'cnc'], pay: [13000, 26000] },
}
const CATEGORIES = Object.keys(ROLES)
const FIRST = ['Ramesh', 'Suresh', 'Priya', 'Anita', 'Rahul', 'Amit', 'Sunita', 'Vikas', 'Pooja', 'Deepak', 'Kavita', 'Manoj', 'Neha', 'Ravi', 'Sanjay', 'Geeta', 'Arjun', 'Lakshmi', 'Imran', 'Fatima', 'Rajesh', 'Meena', 'Gopal', 'Asha', 'Karthik', 'Divya']
const LAST = ['Kumar', 'Sharma', 'Yadav', 'Singh', 'Patel', 'Reddy', 'Nair', 'Das', 'Khan', 'Gupta', 'Verma', 'Naidu', 'Iyer', 'Mondal', 'Shaikh', 'Joshi']
const CO_A = ['Swift', 'Metro', 'Apna', 'Prime', 'Urban', 'Sahyog', 'Bharat', 'Nova', 'Shakti', 'Green', 'Rapid', 'Desi', 'Star', 'Sunrise', 'Royal']
const CO_B = ['Logistics', 'Facility Services', 'Retail', 'Foods', 'Builders', 'Manufacturing', 'Security Services', 'Movers', 'Hospitality', 'Kitchens', 'Mart', 'Cabs']
const SHIFTS = ['day', 'day', 'day', 'night', 'rotational', 'flexible'] as const
const STATUSES = ['applied', 'applied', 'applied', 'shortlisted', 'shortlisted', 'interview', 'hired', 'rejected', 'rejected'] as const
const FLOW = ['applied', 'shortlisted', 'interview', 'hired'] as const

export const DEMO = { worker: '9000000001', employer: '9000000002', password: 'demo1234' }

function describe(title: string, city: string, shift: string, skills: string[]) {
  return `We are hiring a ${title} in ${city}. ${shift[0]!.toUpperCase() + shift.slice(1)} shift, weekly off, salary paid on time to your bank account. ${skills.length ? `Good to have: ${skills.join(', ')}.` : ''} Joining within 7 days. PF and ESI as per rules.`
}

const DAY = 86_400_000
// Dates are relative to when the seed runs, so the feed always looks fresh.
const NOW = Date.now()

export async function seed({ jobs = 50_000, workers = 3_000, employers = 300, applications = 20_000, log = true } = {}) {
  const t0 = Date.now()
  const hash = await bcrypt.hash(DEMO.password, 10)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE users, companies, jobs, applications, application_events RESTART IDENTITY CASCADE')

    // ---- users --------------------------------------------------------
    const roles: string[] = []
    const names: string[] = []
    const phones: string[] = []
    const used = new Set<string>([DEMO.worker, DEMO.employer])
    const phone = () => {
      let p: string
      do p = `${pick(['6', '7', '8', '9'])}${String(between(0, 999_999_999)).padStart(9, '0')}`
      while (used.has(p))
      used.add(p)
      return p
    }
    roles.push('worker', 'employer')
    names.push('Ramesh Kumar', 'Anita Sharma')
    phones.push(DEMO.worker, DEMO.employer)
    for (let i = 0; i < workers - 1; i++) (roles.push('worker'), names.push(`${pick(FIRST)} ${pick(LAST)}`), phones.push(phone()))
    for (let i = 0; i < employers - 1; i++) (roles.push('employer'), names.push(`${pick(FIRST)} ${pick(LAST)}`), phones.push(phone()))

    const userRows = (
      await client.query<{ id: number; role: string }>(
        `INSERT INTO users (role, name, phone, password_hash)
         SELECT r, n, p, $4 FROM unnest($1::user_role[], $2::text[], $3::text[]) AS t(r, n, p)
         RETURNING id, role`,
        [roles, names, phones, hash],
      )
    ).rows
    const workerIds = userRows.filter((u) => u.role === 'worker').map((u) => u.id)
    const employerIds = userRows.filter((u) => u.role === 'employer').map((u) => u.id)

    // ---- worker profiles -----------------------------------------------
    const wCity: string[] = []
    const wSkills: string[] = []
    const wExp: number[] = []
    const wCat: string[] = []
    workerIds.forEach((_id, i) => {
      const cat = i === 0 ? 'delivery' : pick(CATEGORIES)
      wCat.push(cat)
      wCity.push(i === 0 ? 'Bengaluru' : pick(CITIES))
      wSkills.push(sample(ROLES[cat]!.skills, between(1, 3)).join('|'))
      wExp.push(between(0, 12))
    })
    await client.query(
      `INSERT INTO worker_profiles (user_id, city, skills, experience_years)
       SELECT u, c, string_to_array(s, '|'), e FROM unnest($1::bigint[], $2::text[], $3::text[], $4::smallint[]) AS t(u, c, s, e)`,
      [workerIds, wCity, wSkills, wExp],
    )

    // ---- companies -------------------------------------------------------
    const coNames = employerIds.map((_, i) => (i === 0 ? 'Swift Logistics' : `${pick(CO_A)} ${pick(CO_B)}`))
    const companyIds = (
      await client.query<{ id: number }>(
        `INSERT INTO companies (owner_id, name) SELECT * FROM unnest($1::bigint[], $2::text[]) RETURNING id`,
        [employerIds, coNames],
      )
    ).rows.map((r) => r.id)

    // ---- jobs (bulk, in chunks to keep parameter arrays reasonable) -----
    const jobIds: number[] = []
    const jobOpen: boolean[] = []
    const jobCat: string[] = []
    const CHUNK = 10_000
    for (let start = 0; start < jobs; start += CHUNK) {
      const cols = { co: [] as number[], title: [] as string[], desc: [] as string[], cat: [] as string[], city: [] as string[], min: [] as number[], max: [] as number[], shift: [] as string[], open: [] as number[], skills: [] as string[], isOpen: [] as boolean[], at: [] as string[] }
      for (let i = start; i < Math.min(jobs, start + CHUNK); i++) {
        const cat = pick(CATEGORIES)
        const role = ROLES[cat]!
        const title = pick(role.titles)
        const city = pick(CITIES)
        const shift = pick(SHIFTS)
        const skills = sample(role.skills, between(0, 2))
        const min = Math.round(between(role.pay[0], role.pay[1] - 3000) / 500) * 500
        cols.co.push(i < 40 ? companyIds[0]! : pick(companyIds))
        cols.title.push(title)
        cols.desc.push(describe(title, city, shift, skills))
        cols.cat.push(cat)
        cols.city.push(city)
        cols.min.push(min)
        cols.max.push(min + Math.round(between(1000, 6000) / 500) * 500)
        cols.shift.push(shift)
        cols.open.push(between(1, 10))
        cols.skills.push(skills.join('|'))
        cols.isOpen.push(rand() > 0.12)
        cols.at.push(new Date(NOW - Math.floor(rand() * 60 * DAY)).toISOString())
      }
      const rows = (
        await client.query<{ id: number; is_open: boolean }>(
          `INSERT INTO jobs (company_id, title, description, category, city, salary_min, salary_max, shift, openings, skills, is_open, created_at)
           SELECT co, ti, de, ca, ci, mi, ma, sh::shift_type, op, COALESCE(string_to_array(NULLIF(sk, ''), '|'), '{}'), io, at
           FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::text[], $9::int[], $10::text[], $11::bool[], $12::timestamptz[])
             AS t(co, ti, de, ca, ci, mi, ma, sh, op, sk, io, at)
           RETURNING id, is_open`,
          [cols.co, cols.title, cols.desc, cols.cat, cols.city, cols.min, cols.max, cols.shift, cols.open, cols.skills.map((s) => s || ''), cols.isOpen, cols.at],
        )
      ).rows
      rows.forEach((r, k) => (jobIds.push(r.id), jobOpen.push(r.is_open), jobCat.push(cols.cat[k]!)))
    }

    // ---- applications + their history ------------------------------------
    const pairs = new Set<string>()
    const aJob: number[] = []
    const aWorker: number[] = []
    const aStatus: string[] = []
    const openJobs = jobIds.filter((_, i) => jobOpen[i])
    const demoJobs = jobIds.slice(0, 40)
    const workersByCat = new Map<string, number[]>()
    workerIds.forEach((w, i) => workersByCat.set(wCat[i]!, [...(workersByCat.get(wCat[i]!) ?? []), w]))
    const catOf = new Map(jobIds.map((id, i) => [id, jobCat[i]!]))
    while (aJob.length < applications) {
      // Give the demo employer's jobs plenty of applicants so the dashboard isn't empty.
      const job = aJob.length < 600 ? pick(demoJobs) : pick(openJobs)
      // Most people apply within their own trade, so most applicants share some skills with the job.
      const sameTrade = workersByCat.get(catOf.get(job)!) ?? workerIds
      const worker = rand() < 0.75 ? pick(sameTrade) : pick(workerIds)
      const key = `${job}:${worker}`
      if (pairs.has(key)) continue
      pairs.add(key)
      aJob.push(job)
      aWorker.push(worker)
      aStatus.push(pick(STATUSES))
    }
    const appRows = (
      await client.query<{ id: number; status: string; created_at: Date }>(
        `INSERT INTO applications (job_id, worker_id, status, created_at, updated_at)
         SELECT j, w, s::application_status, now() - (random() * interval '20 days'), now()
         FROM unnest($1::bigint[], $2::bigint[], $3::text[]) AS t(j, w, s)
         RETURNING id, status, created_at`,
        [aJob, aWorker, aStatus],
      )
    ).rows

    const eApp: number[] = []
    const eFrom: (string | null)[] = []
    const eTo: string[] = []
    const eAt: string[] = []
    for (const a of appRows) {
      const steps: string[] = a.status === 'rejected' ? [...FLOW.slice(0, between(1, 3)), 'rejected'] : [...FLOW.slice(0, FLOW.indexOf(a.status as (typeof FLOW)[number]) + 1)]
      let t = a.created_at.getTime()
      steps.forEach((to, i) => {
        eApp.push(a.id)
        eFrom.push(i === 0 ? null : steps[i - 1]!)
        eTo.push(to)
        eAt.push(new Date(t).toISOString())
        t += between(2, 72) * 3_600_000
      })
    }
    await client.query(
      `INSERT INTO application_events (application_id, from_status, to_status, created_at)
       SELECT a, f::application_status, t::application_status, at FROM unnest($1::bigint[], $2::text[], $3::text[], $4::timestamptz[]) AS x(a, f, t, at)`,
      [eApp, eFrom, eTo, eAt],
    )

    // Keep seeded data consistent with the API's rules: a job can't have more hires
    // than openings, and a job whose openings are all filled is closed.
    await client.query(`
      WITH h AS (SELECT job_id, count(*)::int AS hired FROM applications WHERE status = 'hired' GROUP BY job_id)
      UPDATE jobs j SET openings = greatest(j.openings, h.hired), is_open = j.is_open AND h.hired < j.openings
      FROM h WHERE h.job_id = j.id`)

    await client.query('COMMIT')
    await client.query('ANALYZE')
    if (log) {
      console.log(`seeded ${workerIds.length} workers, ${employerIds.length} employers, ${jobIds.length} jobs, ${appRows.length} applications in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      console.log(`demo worker:   ${DEMO.worker} / ${DEMO.password}`)
      console.log(`demo employer: ${DEMO.employer} / ${DEMO.password}`)
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const small = process.argv.includes('--small')
  seed(small ? { jobs: 2_000, workers: 300, employers: 40, applications: 1_500 } : {})
    .catch((err) => {
      console.error(err)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
