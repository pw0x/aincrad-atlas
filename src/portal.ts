type Language = 'zh-CN' | 'en'
type Commit = { sha: string; title: string; url: string; date: string }
type Task = { number: number; title: string; url: string; date: string }
type Progress = {
  source: 'github' | 'cached' | 'unavailable'
  updatedAt: string | null
  version: string
  changes: Commit[]
  tasks: Task[]
  openTaskCount: number | null
}
const repo = 'https://github.com/pw0x/aincrad-atlas'
const English: Record<string, string> = {
  skip: 'Skip to content', navScenes: 'Scene index', navProgress: 'Development', navFeedback: 'Visitor feedback',
  heroKicker: 'SWORD ART ONLINE · OPEN WORLD PROJECT', heroTitle: 'Aincrad',
  heroIntro: 'Explore a hundred-floor castle above the clouds, down to the carving on a cabin door. People and AI agents around the world are building Aincrad together.',
  enter: 'Enter the castle', browse: 'Browse scenes', heroCaption: 'The floating castle', download: 'Offline editions',
  townFloor: 'FLOOR 01', cabinFloor: 'FLOOR 22', castleFloor: 'EXTERIOR',
  town: 'Town of Beginnings', townSummary: 'A clock tower overlooks the stone square, a cartographer’s stall and a glassworker’s gallery.',
  chart: 'Survey plate', glass: 'Glass workshop', cabin: 'Lakeside Cabin',
  cabinSummary: 'Cross the porch at the forest’s edge and open a field journal beside the lake window.', lake: 'Across the lake', journal: 'Field journal',
  castle: 'The Floating Castle', castleSummary: 'Follow a hundred tiers of rock and iron, from the cantilevered wings to the Ruby Palace.', arms: 'Outer wings', palace: 'Ruby Palace',
  loading: 'Reading the project record…', changes: 'Recent changes', allChanges: 'All commits', tasks: 'Tasks to claim', allTasks: 'Task board',
  feedbackTitle: 'Leave a field note', feedbackIntro: 'Choose a scene and describe what you found. Your note, a 3D screenshot, the camera position and the build revision become a public task for a project agent.',
  vision: 'World vision', guide: 'Agent guide', credits: 'Credits and licences',
}
const announcements = {
  'zh-CN': {
    unavailable: '暂时无法读取 GitHub 记录，可通过各栏链接查看。',
    synced: '上次同步', cached: '显示缓存，上次成功同步', version: '本站版本',
    noChanges: '还没有可显示的提交。', noTasks: '当前没有可认领的任务。',
    taskTotal: (n: number) => '全部任务（' + n + '）',
    title: '浮游城图志 · Aincrad Atlas', nav: '项目导航', resources: '项目资源',
  },
  en: {
    unavailable: 'GitHub activity is currently unavailable. Use the links below to view the repository.',
    synced: 'Last synced', cached: 'Cached · last successful sync', version: 'Site build',
    noChanges: 'No commits to display yet.', noTasks: 'There are currently no open tasks to claim.',
    taskTotal: (n: number) => 'All tasks (' + n + ')',
    title: 'Aincrad Atlas · Explore the floating castle', nav: 'Project navigation', resources: 'Project resources',
  },
}
const find = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const copyNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-text]'))
const Chinese = Object.fromEntries(copyNodes.map(node => [node.dataset.text!, node.textContent!]))
const button = find<HTMLButtonElement>('#language')
let language: Language = 'zh-CN'
let progress: Progress | null = null
let loading = true

function formatDate(timestamp: string, includeTime = false) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  if (includeTime) Object.assign(options, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  return new Intl.DateTimeFormat(language, options).format(date)
}

function addRecord(list: HTMLUListElement, url: string, title: string, key: string, timestamp: string) {
  const li = document.createElement('li')
  const link = document.createElement('a')
  link.className = 'record'
  link.href = url
  const copy = document.createElement('span')
  const identifier = document.createElement('span')
  identifier.className = 'record-key'
  identifier.textContent = key
  const label = document.createElement('span')
  label.className = 'record-title'
  label.textContent = title
  copy.append(identifier, ' ', label)
  const time = document.createElement('time')
  time.dateTime = timestamp
  time.textContent = formatDate(timestamp)
  link.append(copy, time)
  li.append(link)
  list.append(li)
}

function addEmpty(list: HTMLUListElement, message: string) {
  const empty = document.createElement('li')
  empty.className = 'empty'
  empty.textContent = message
  list.append(empty)
}

function renderProgress() {
  const words = announcements[language]
  const state = find('#sync-state')
  const revision = find<HTMLAnchorElement>('#revision')
  const changes = find<HTMLUListElement>('#change-list')
  const tasks = find<HTMLUListElement>('#task-list')
  changes.replaceChildren()
  tasks.replaceChildren()
  revision.hidden = true
  const taskLink = find('#task-link')
  taskLink.textContent = language === 'en' ? English.allTasks : Chinese.allTasks
  if (loading) return
  if (progress && /^[a-f0-9]{7,40}$/i.test(progress.version)) {
    revision.textContent = words.version + ' ' + progress.version.slice(0, 7)
    revision.href = repo + '/commit/' + progress.version
    revision.hidden = false
  }
  if (!progress || progress.source === 'unavailable') {
    state.textContent = words.unavailable
    return
  }
  const updated = progress.updatedAt && formatDate(progress.updatedAt, true)
  state.textContent = updated ? (progress.source === 'cached' ? words.cached : words.synced) + ' · ' + updated : words.unavailable
  for (const item of progress.changes.slice(0, 5)) {
    if (/^[a-f0-9]{7,40}$/i.test(item.sha)) addRecord(changes, repo + '/commit/' + item.sha, item.title, item.sha.slice(0, 7), item.date)
  }
  for (const item of progress.tasks.slice(0, 5)) {
    if (Number.isSafeInteger(item.number) && item.number > 0) addRecord(tasks, repo + '/issues/' + item.number, item.title, '#' + item.number, item.date)
  }
  if (typeof progress.openTaskCount === 'number') taskLink.textContent = words.taskTotal(progress.openTaskCount)
  if (!changes.childElementCount) addEmpty(changes, words.noChanges)
  if (!tasks.childElementCount) addEmpty(tasks, words.noTasks)
}

function useLanguage(choice: Language) {
  language = choice
  const english = choice === 'en'
  const copy = english ? English : Chinese
  document.documentElement.lang = choice
  document.title = announcements[choice].title
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')!
  description.content = copy.heroIntro
  copyNodes.forEach(node => { node.textContent = copy[node.dataset.text!] })
  button.textContent = english ? '简体中文' : 'English'
  button.lang = english ? 'zh-CN' : 'en'
  button.setAttribute('aria-label', english ? '切换到简体中文' : 'Switch to English')
  find('[data-label="nav"]').setAttribute('aria-label', announcements[choice].nav)
  find('[data-label="resources"]').setAttribute('aria-label', announcements[choice].resources)
  find<HTMLAnchorElement>('#vision').href = repo + '/blob/main/docs/WORLD_DESIGN.md#' + (english ? 'english' : '简体中文')
  renderProgress()
}

const requested = new URLSearchParams(location.search).get('lang')
let remembered: string | null = null
try { remembered = localStorage.getItem('aincrad-atlas.portal-language') } catch { /* Browsing without storage remains supported. */ }
const preferred = requested ?? remembered ?? navigator.language
useLanguage(/^en\b/i.test(preferred) ? 'en' : 'zh-CN')
button.hidden = false
button.addEventListener('click', () => {
  const next = language === 'en' ? 'zh-CN' : 'en'
  useLanguage(next)
  const url = new URL(location.href)
  url.searchParams.set('lang', next)
  history.replaceState(null, '', url)
  try { localStorage.setItem('aincrad-atlas.portal-language', next) } catch { /* The selection is already in the URL. */ }
})

async function loadProgress() {
  try {
    const response = await fetch('/api/progress', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Progress unavailable')
    const payload = await response.json()
    if (!['github', 'cached', 'unavailable'].includes(payload?.source) || !Array.isArray(payload.changes) || !Array.isArray(payload.tasks)) throw new Error('Invalid progress')
    progress = payload
  } catch {
    progress = null
  } finally {
    loading = false
    renderProgress()
  }
}
void loadProgress()
