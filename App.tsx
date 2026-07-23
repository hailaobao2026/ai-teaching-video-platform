import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CircleUserRound,
  Clapperboard,
  ClipboardCheck,
  GraduationCap,
  Home as HomeIcon,
  Library,
  ListChecks,
  LogIn,
  LogOut,
  Settings,
  Sparkles,
  WandSparkles
} from 'lucide-react';
import type { AppView, CourseItem, GenerationJob, User } from './types';
import { adminService, authService, catalogService, courseService, jobService, modelSettingsService, teacherService } from './services/api';

const SUBJECTS = [
  { code: 'chinese', name: '语文' },
  { code: 'math', name: '数学' },
  { code: 'english', name: '英语' },
  { code: 'physics', name: '物理' },
  { code: 'chemistry', name: '化学' },
  { code: 'biology', name: '生物' },
  { code: 'geography', name: '地理' },
  { code: 'history', name: '历史' },
  { code: 'politics', name: '政治' }
];

const GRADES = [
  { code: 'grade1', name: '一年级' },
  { code: 'grade2', name: '二年级' },
  { code: 'grade3', name: '三年级' },
  { code: 'grade4', name: '四年级' },
  { code: 'grade5', name: '五年级' },
  { code: 'grade6', name: '六年级' },
  { code: 'grade7', name: '初一' },
  { code: 'grade8', name: '初二' },
  { code: 'grade9', name: '初三' },
  { code: 'grade10', name: '高一' },
  { code: 'grade11', name: '高二' },
  { code: 'grade12', name: '高三' }
];

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [preflight, setPreflight] = useState<any>(null);

  const [form, setForm] = useState({
    subject: 'physics',
    grade: 'grade8',
    chapter: '机械能与能量',
    topic: '能量守恒定律',
    learningGoals: [] as string[],
    animationPack: '' as string,
    styleNotes: '口语化，适合暑假复习',
    outputProfile: 'teaching_video_full',
    article: '',
    style: 'cozy-handdrawn',
    autoCreateCourse: true,
    imageProvider: '',
    ttsProvider: '',
    videoQuality: ''
  });
  const [modelHint, setModelHint] = useState<string>('');

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginIdentity, setLoginIdentity] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [loginForm, setLoginForm] = useState({
    email: 'teacher@demo.local',
    password: 'demo123',
    nickname: '系统管理员',
    role: 'student' as 'student' | 'teacher',
    grade: 'grade8',
    teacherSubjects: ['physics'] as string[]
  });

  const DEMO_ACCOUNTS = {
    admin: { email: 'teacher@demo.local', password: 'demo123', nickname: '系统管理员', label: '管理员' },
    teacher: { email: 'physics.teacher@demo.local', password: 'demo123', nickname: '物理老师', label: '教师' },
    student: { email: 'student@demo.local', password: 'demo123', nickname: '演示学生', label: '学生' }
  } as const;
  const [gradeOptions, setGradeOptions] = useState<{ code: string; name: string }[]>(GRADES);
  const [subjectOptions, setSubjectOptions] = useState<{ code: string; name: string }[]>(SUBJECTS);

  async function refresh() {
    try {
      const me = await authService.me();
      setUser(me.user);
    } catch {
      setUser(null);
    }
    try {
      setCourses(await courseService.listPublic());
    } catch {
      setCourses([]);
    }
    if (localStorage.getItem('atv_token')) {
      try { setJobs(await jobService.list()); } catch { setJobs([]); }
      try { setMyCourses(await courseService.mine()); } catch { setMyCourses([]); }
      try { setStats(await adminService.stats()); } catch { setStats(null); }
    }
  }

  useEffect(() => { refresh(); }, [view]);

  useEffect(() => {
    catalogService.subjects().then((rows) => {
      if (Array.isArray(rows) && rows.length) setSubjectOptions(rows.map((r: any) => ({ code: r.code, name: r.name })));
    }).catch(() => { /* keep defaults */ });
    catalogService.grades().then((rows) => {
      if (Array.isArray(rows) && rows.length) setGradeOptions(rows.map((r: any) => ({ code: r.code, name: r.name })));
    }).catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    if (view !== 'jobs' || !user) return;
    const timer = window.setInterval(() => {
      jobService.list().then(setJobs).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [view, user]);


  const nav = useMemo(() => ([
    { id: 'home', label: '首页', icon: HomeIcon },
    { id: 'create', label: '生成教学视频', icon: WandSparkles },
    { id: 'jobs', label: '我的任务', icon: ListChecks },
    { id: 'courses', label: '课程广场', icon: Library },
    { id: 'my-courses', label: '我的课程', icon: BookOpen },
    { id: 'profile', label: '个人中心', icon: CircleUserRound },
    { id: 'teacher-review', label: '待我审核', icon: ClipboardCheck },
    { id: 'admin', label: '管理后台', icon: Settings },
    { id: 'admin-knowledge', label: '学科与知识点', icon: GraduationCap }
  ] as const).filter(item => {
    if (item.id === 'admin' || item.id === 'admin-knowledge') return user?.role === 'admin';
    if (item.id === 'teacher-review') return user?.role === 'teacher' || user?.role === 'admin';
    return true;
  }), [user?.role]);

  function applyLoginIdentity(identity: 'admin' | 'teacher' | 'student') {
    const account = DEMO_ACCOUNTS[identity];
    setLoginIdentity(identity);
    setLoginForm(prev => ({
      ...prev,
      email: account.email,
      password: account.password,
      nickname: account.nickname,
      role: identity === 'teacher' ? 'teacher' : 'student',
      teacherSubjects: identity === 'teacher' ? ['physics'] : prev.teacherSubjects
    }));
  }

  async function handleLogin(register = false) {
    try {
      if (register && authMode !== 'register') {
        setAuthMode('register');
      }
      const res = register
        ? await authService.register({
            email: loginForm.email,
            password: loginForm.password,
            nickname: loginForm.nickname,
            role: loginForm.role,
            grade: loginForm.role === 'student' ? loginForm.grade : undefined,
            teacherSubjects: loginForm.role === 'teacher' ? loginForm.teacherSubjects : undefined
          })
        : await authService.login(loginForm.email, loginForm.password);
      localStorage.setItem('atv_token', res.token);
      setUser(res.user);
      const roleLabel = res.user?.role === 'admin' ? '管理员' : res.user?.role === 'teacher' ? '教师' : '学生';
      setMessage(register ? `注册并登录成功（${roleLabel}）` : `登录成功（${roleLabel}）`);
      setView(res.user?.role === 'admin' ? 'admin' : 'create');
    } catch (e: any) {
      setMessage(e.message || '登录失败');
    }
  }

  function toggleTeacherSubject(code: string) {
    setLoginForm(prev => {
      const exists = prev.teacherSubjects.includes(code);
      const teacherSubjects = exists
        ? prev.teacherSubjects.filter(item => item !== code)
        : [...prev.teacherSubjects, code];
      return { ...prev, teacherSubjects };
    });
  }

  async function handleLogout() {
    try { await authService.logout(); } catch { /* local logout still applies */ }
    localStorage.removeItem('atv_token');
    setUser(null);
    setJobs([]);
    setMyCourses([]);
    setStats(null);
    setMessage('已退出登录');
    setView('home');
  }

  async function handleCreateJob() {
    if (!user) {
      setMessage('请先登录后再提交生成任务（左侧「登录/注册」）');
      setView('login');
      return;
    }
    try {
      setMessage('正在检查生成环境并创建任务…');
      const readiness = await jobService.preflight(form);
      setPreflight(readiness);
      if (!readiness.ok) {
        setMessage(`生成环境未就绪：${readiness.checks.filter((item: any) => item.required && !item.ok).map((item: any) => item.detail).join('；')}`);
        return;
      }
      const payload: any = { ...form };
      if (!payload.imageProvider) delete payload.imageProvider;
      if (!payload.ttsProvider) delete payload.ttsProvider;
      if (!payload.videoQuality) delete payload.videoQuality;
      if (!payload.animationPack) delete payload.animationPack;
      if (!Array.isArray(payload.learningGoals) || !payload.learningGoals.length) delete payload.learningGoals;
      const res = await jobService.create(payload);
      setMessage(`任务已创建：${res.jobId || res.id || ''}，可在「我的任务」查看进度`);
      setView('jobs');
      setJobs(await jobService.list());
    } catch (e: any) {
      const msg = e?.message || '创建失败';
      if (msg.includes('未登录') || msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        setMessage('登录已失效或未登录，请先登录后再提交');
        setView('login');
        return;
      }
      setMessage(msg);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Clapperboard size={22} /></span>
          <span className="brand-copy">
            <strong>AI 教学</strong>
            <span>视频创作平台</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {nav.map(item => {
            const NavIcon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                className={`nav-btn ${active ? 'active' : ''}`}
                onClick={() => setView(item.id as AppView)}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon size={19} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden="true">
            {user ? user.nickname?.charAt(0).toUpperCase() : <CircleUserRound size={20} />}
          </div>
          <div className="user-meta">
            <strong>{user ? user.nickname : '点击登录'}</strong>
            <span>{user ? (user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '教师' : '学生') : '体验完整创作流程'}</span>
          </div>
          <button
            className="account-action"
            onClick={() => user ? handleLogout() : setView('login')}
            aria-label={user ? '退出登录' : '登录或注册'}
            title={user ? '退出登录' : '登录或注册'}
          >
            {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          </button>
        </div>
      </aside>

      <main id="main-content" className="main">
        {message && (
          <div className="message-banner" role="status">
            <Sparkles size={18} aria-hidden="true" />
            <span>{message}</span>
          </div>
        )}

        {view === 'home' && (
          <>
            <div className="hero">
              <div className="card hero-panel">
                <div className="eyebrow"><Sparkles size={16} aria-hidden="true" /> AI 教学媒体工作台</div>
                <h1>把 K12 知识点变成可分享的教学动画视频</h1>
                <p className="muted">
                  输入学科与课程内容，平台调用 <code>ai-teaching-media</code> skill，
                  自动完成分镜、配音、渲染，并按课程分类管理上架。
                </p>
                <div className="row" style={{ marginTop: 16 }}>
                  <button className="btn" onClick={() => setView('create')}><WandSparkles size={18} aria-hidden="true" />开始生成</button>
                  <button className="btn secondary" onClick={() => setView('courses')}><Library size={18} aria-hidden="true" />课程广场</button>
                </div>
              </div>
              <div className="stat">
                <div className="stat-label"><Clapperboard size={17} aria-hidden="true" />核心引擎</div>
                <strong>ai-teaching-media</strong>
                <div style={{ opacity: 0.85, marginTop: 8 }}>storyboard → TTS → HyperFrames → MP4</div>
              </div>
            </div>
            <div className="grid cols-3 feature-grid">
              <div className="card feature-step"><span>01</span><h3>课程输入</h3><p className="muted">学科 / 年级 / 知识点 / 学习目标</p></div>
              <div className="card feature-step"><span>02</span><h3>异步生成</h3><p className="muted">Worker 调用 skill，产出 1080p 配音视频</p></div>
              <div className="card feature-step"><span>03</span><h3>分类分享</h3><p className="muted">审核后进入广场，同学可学习与再创作</p></div>
            </div>
          </>
        )}

        {view === 'login' && (
          <div className="card" style={{ maxWidth: 640 }}>
            <h2>登录 / 注册</h2>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <button className={authMode === 'login' ? 'btn' : 'btn secondary'} onClick={() => setAuthMode('login')}>登录</button>
              <button className={authMode === 'register' ? 'btn' : 'btn secondary'} onClick={() => setAuthMode('register')}>注册</button>
            </div>
            {authMode === 'login' ? (
              <p className="muted">支持管理员 / 教师 / 学生登录。管理员账号由系统初始化，不走公开注册。</p>
            ) : (
              <p className="muted">公开注册仅支持学生或教师；教师须至少选择一个授课学科。管理员不可公开注册。</p>
            )}
            <div className="grid" style={{ gap: 12 }}>
              {authMode === 'login' && (
                <div>
                  <div className="muted" style={{ marginBottom: 8 }}>快速选择登录身份（自动填充演示账号）</div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {([
                      ['admin', '管理员'],
                      ['teacher', '教师'],
                      ['student', '学生']
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={loginIdentity === id ? 'btn' : 'btn secondary'}
                        onClick={() => applyLoginIdentity(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                    当前：{DEMO_ACCOUNTS[loginIdentity].label} · {DEMO_ACCOUNTS[loginIdentity].email} / {DEMO_ACCOUNTS[loginIdentity].password}
                  </div>
                </div>
              )}
              <label>邮箱<input value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="teacher@demo.local" /></label>
              {authMode === 'register' && (
                <label>昵称<input value={loginForm.nickname} onChange={e => setLoginForm({ ...loginForm, nickname: e.target.value })} /></label>
              )}
              <label>密码<input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} /></label>
              {authMode === 'register' && (
                <>
                  <label>注册角色
                    <select value={loginForm.role} onChange={e => setLoginForm({ ...loginForm, role: e.target.value as 'student' | 'teacher' })}>
                      <option value="student">学生</option>
                      <option value="teacher">教师</option>
                    </select>
                  </label>
                  {loginForm.role === 'student' && (
                    <label>年级（可选）
                      <select value={loginForm.grade} onChange={e => setLoginForm({ ...loginForm, grade: e.target.value })}>
                        <option value="grade7">初一</option>
                        <option value="grade8">初二</option>
                        <option value="grade9">初三</option>
                        <option value="grade10">高一</option>
                      </select>
                    </label>
                  )}
                  {loginForm.role === 'teacher' && (
                    <div>
                      <div className="muted" style={{ marginBottom: 8 }}>授课学科（至少 1 个）</div>
                      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                        {subjectOptions.map(item => (
                          <label key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={loginForm.teacherSubjects.includes(item.code)}
                              onChange={() => toggleTeacherSubject(item.code)}
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="row">
                {authMode === 'login' ? (
                  <button className="btn" onClick={() => handleLogin(false)}>登录</button>
                ) : (
                  <button className="btn" onClick={() => handleLogin(true)}>注册并登录</button>
                )}
                <button className="btn secondary" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? '去注册学生/教师' : '返回登录'}
                </button>
              </div>
              {authMode === 'login' && (
                <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)', margin: 0 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>演示账号</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                    <div>管理员：teacher@demo.local / demo123</div>
                    <div>教师：physics.teacher@demo.local / demo123</div>
                    <div>学生：student@demo.local / demo123</div>
                  </div>
                </div>
              )}
              {user && (
                <p className="muted">当前：{user.nickname}（{user.role}{user.teacherSubjects?.length ? ` / ${user.teacherSubjects.join(',')}` : ''}）</p>
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="grid cols-2">
            <div className="card">
              <h2>生成教学视频</h2>
              <p className="muted">默认产出类似 energy-conservation.mp4 的配音教学成片。</p>
              <div className="grid" style={{ gap: 12, marginTop: 12 }}>
                <KnowledgeSelector
                  subjects={subjectOptions.length ? subjectOptions : SUBJECTS}
                  grades={gradeOptions.length ? gradeOptions : GRADES}
                  value={form}
                  onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                />
                <label>补充说明<textarea value={form.styleNotes} onChange={e => setForm({ ...form, styleNotes: e.target.value })} /></label>
                <label>文章原文（文章插图/章节解说档位必填）<textarea value={form.article} onChange={e => setForm({ ...form, article: e.target.value })} /></label>
                <label>视觉风格
                  <select value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}>
                    <option value="cozy-handdrawn">温暖手绘</option>
                    <option value="notebook">笔记本手绘</option>
                    <option value="infographic">专业信息图</option>
                    <option value="executive-tech">商务科技</option>
                    <option value="whiteboard-sketch">白板手绘</option>
                  </select>
                </label>
                <label>产出档位
                  <select value={form.outputProfile} onChange={e => { setForm({ ...form, outputProfile: e.target.value }); setPreflight(null); }}>
                    <option value="teaching_video_full">配音教学视频（推荐）</option>
                    <option value="package_all">视频 + 信息图 + 封面</option>
                    <option value="infographic_only">仅信息图</option>
                    <option value="tech_article_diagram">技术文章插图</option>
                    <option value="article_explainer_video">文章章节解说视频</option>
                    <option value="short_video_cover">短视频封面</option>
                    <option value="image_generation">通用生图</option>
                  </select>
                </label>
                <div className="grid cols-3">
                  <label>图片 Provider 覆盖
                    <select value={form.imageProvider} onChange={e => setForm({ ...form, imageProvider: e.target.value })}>
                      <option value="">跟随模型设置</option>
                      <option value="agnes">agnes</option>
                      <option value="mulerun">mulerun</option>
                      <option value="apimart">apimart</option>
                      <option value="atlascloud">atlascloud</option>
                      <option value="volcengine">volcengine (火山 Seedream)</option>
                    </select>
                  </label>
                  <label>TTS 覆盖
                    <select value={form.ttsProvider} onChange={e => setForm({ ...form, ttsProvider: e.target.value })}>
                      <option value="">跟随模型设置</option>
                      <option value="edge">edge</option>
                      <option value="seed">seed (火山 Seed TTS 2.0)</option>
                      <option value="minimax">minimax</option>
                      <option value="say">say</option>
                    </select>
                  </label>
                  <label>渲染质量覆盖
                    <select value={form.videoQuality} onChange={e => setForm({ ...form, videoQuality: e.target.value })}>
                      <option value="">跟随模型设置</option>
                      <option value="draft">draft</option>
                      <option value="standard">standard</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                </div>
                {modelHint && <div className="muted">{modelHint}</div>}
                <button className="btn" onClick={handleCreateJob}>提交生成任务</button>
                {preflight && <div className={preflight.ok ? 'muted' : 'badge bad'}>{preflight.ok ? '生成依赖检查通过' : `缺少：${preflight.missing.join('、')}`}</div>}
              </div>
            </div>
            <div className="card">
              <h3>生成链路预览</h3>
              <p className="muted" style={{ marginTop: 0 }}>说明：右侧是流程说明，不是实时进度。提交成功后请到左侧「我的任务」查看状态/进度条。</p>
              <ol className="muted">
                <li>构建 7 段 storyboard</li>
                <li>Edge / Minimax TTS 配音</li>
                <li>scaffold + 场景填充</li>
                <li>HyperFrames 渲染 1080p（通常最耗时）</li>
                <li>若选「视频+信息图+封面」：再串行调用文生图 3 次（信息图/封面/概念图）</li>
                <li>按课程分类入库，可送审分享</li>
              </ol>
              {form.outputProfile === 'package_all' && (
                <p className="muted">该模式 = 完整教学视频 + 3 张生图，耗时约为「仅视频」的 1.3~2 倍，主要卡在 HyperFrames 渲染与 Agnes 生图排队。</p>
              )}
            </div>
          </div>
        )}

        {view === 'jobs' && (
          <div className="card">
            <h2>我的任务</h2>
            <p className="muted">「视频+信息图+封面」成功后，请点「产物」查看封面/信息图/概念图；列表默认只突出视频入口。</p>
            <table>
              <thead>
                <tr>
                  <th>主题</th><th>状态</th><th>进度</th><th>阶段</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <JobRow key={job.id} job={job} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'courses' && (
          <div className="grid cols-3">
            {courses.map(c => (
              <div className="card course-card" key={c.id}>
                {c.coverUrl && (
                  <img src={c.coverUrl} alt={`${c.title} 封面`} style={{ width: '100%', borderRadius: 12, marginBottom: 8, objectFit: 'cover', maxHeight: 220 }} />
                )}
                {c.videoUrl ? <video src={c.videoUrl} controls preload="metadata" /> : <div className="muted">暂无视频</div>}
                <h3 style={{ marginTop: 12 }}>{c.title}</h3>
                <div className="muted">{c.subject} · {c.grade} · {c.chapter}</div>
                <p>{c.summary}</p>
                <div className="row">
                  <span className="badge">{c.publishStatus}</span>
                  <span className="muted">{c.authorName}</span>
                  {user?.role === 'admin' && (
                    <button
                      className="btn secondary"
                      onClick={async () => {
                        if (!confirm(`确认删除课程「${c.title}」？此操作不可恢复。`)) return;
                        try {
                          await adminService.deleteCourse(c.id);
                          setMessage(`已删除课程：${c.title}`);
                          await refresh();
                        } catch (e: any) {
                          setMessage(e?.message || '删除失败');
                        }
                      }}
                    >删除</button>
                  )}
                </div>
              </div>
            ))}
            {!courses.length && <div className="card muted">暂无公开课程，去生成并送审吧。</div>}
          </div>
        )}

        {view === 'my-courses' && (
          <div className="card">
            <h2>我的课程</h2>
            <table>
              <thead><tr><th>标题</th><th>状态</th><th>审核意见</th><th>操作</th></tr></thead>
              <tbody>
                {myCourses.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        {c.coverUrl && <img src={c.coverUrl} alt="cover" style={{ width: 42, height: 56, objectFit: 'cover', borderRadius: 6 }} />}
                        <div>
                          <div>{c.title}</div>
                          <div className="row" style={{ gap: 8 }}>
                            {c.videoUrl && <a href={c.videoUrl} target="_blank" rel="noreferrer">视频</a>}
                            {c.coverUrl && <a href={c.coverUrl} target="_blank" rel="noreferrer">封面</a>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge">{c.publishStatus}</span></td>
                    <td className="muted" style={{ maxWidth: 280 }}>
                      {c.latestReview
                        ? `${c.latestReview.action}${c.latestReview.comment ? `：${c.latestReview.comment}` : ''}`
                        : (c.publishStatus === 'pending'
                          ? ((c.authorRole === 'student' || c.authorRoleSnapshot === 'student')
                            ? '审核中（学科教师/管理员）'
                            : '审核中（仅管理员）')
                          : '-')}
                    </td>
                    <td className="row">
                      {(c.publishStatus === 'draft' || c.publishStatus === 'rejected') && (
                        <button className="btn secondary" onClick={() => courseService.submit(c.id).then(refresh)}>
                          {c.publishStatus === 'rejected' ? '修改后重送审' : '送审'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'profile' && user && (
          <div className="card">
            <h2>个人中心</h2>
            <ProfilePanel user={user} subjects={subjectOptions} onSaved={(u) => { setUser(u); setMessage('资料已更新'); }} />
          </div>
        )}

        {view === 'teacher-review' && (
          <div className="card">
            <h2>待我审核</h2>
            {user?.role === 'admin' ? (
              <>
                <p className="muted">
                  管理员审核全量待审课程（含学生无对口教师兜底、教师作品、管理员作品）。
                  教师侧「待我审核」只收本学科学生作品，因此管理员自己提交的课程不会出现在教师队列。
                </p>
                <AdminReview onDone={refresh} />
              </>
            ) : (
              <>
                <p className="muted">仅展示本学科学生待审作品；教师/管理员作品由管理员审核。跨学科不可见。</p>
                <TeacherReview onDone={refresh} />
              </>
            )}
          </div>
        )}

        {view === 'admin' && (
          <div className="grid" style={{ gap: 16 }}>
            <div className="grid cols-3">
              <div className="card"><div className="muted">用户</div><h2>{stats?.users ?? '-'}</h2></div>
              <div className="card"><div className="muted">任务</div><h2>{stats?.jobs ?? '-'}</h2></div>
              <div className="card"><div className="muted">待审课程</div><h2>{stats?.pendingReviews ?? '-'}</h2></div>
            </div>
            <div className="grid cols-2">
              <div className="card">
                <h3>待审课程</h3>
                <AdminReview onDone={refresh} />
              </div>
              <div className="card">
                <h3>系统模型默认（TTS / 文生图）</h3>
                <p className="muted">这里改的是全站默认；各角色可在「个人中心 → 模型设置」覆盖。</p>
                <AdminConfig />
              </div>
            </div>
            <div className="card">
              <h3>用户管理</h3>
              <AdminUsers subjects={subjectOptions} />
            </div>
            <div className="card">
              <h3>学科与知识点</h3>
              <p className="muted">学科/知识点维护已移到左侧菜单「学科与知识点」，避免管理后台页面过长。</p>
              <button className="btn" onClick={() => setView('admin-knowledge')}>打开学科与知识点管理</button>
            </div>
          </div>
        )}

        {view === 'admin-knowledge' && user?.role === 'admin' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>学科与知识点管理</h2>
                <p className="muted" style={{ margin: 0 }}>维护大类学科与子类知识点；生成页可下拉选择或关键字搜索填入章节/主题。</p>
              </div>
              <button className="btn secondary" onClick={() => setView('admin')}>返回管理后台</button>
            </div>
            <div style={{ marginTop: 16 }}>
              <AdminKnowledge />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AdminConfig() {
  const [config, setConfig] = useState<any>({
    teaching_media_root: '',
    default_tts_provider: 'edge',
    default_edge_voice: 'zh-CN-XiaoxiaoNeural',
    default_seed_voice: 'zh_female_vv_uranus_bigtts',
    default_image_provider: 'volcengine',
    default_video_provider: 'hyperframes',
    hyperframes_quality: 'draft',
    'models.tts.allowlist': 'edge,minimax,seed,say',
    'models.image.allowlist': 'agnes,mulerun,apimart,atlascloud,volcengine',
    'models.video.allowlist': 'hyperframes'
  });
  const [catalog, setCatalog] = useState<any>({ tts: [], image: [], video: [] });
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([
      adminService.config(),
      modelSettingsService.catalog().catch(() => ({ tts: [], image: [], video: [] }))
    ]).then(([value, cat]) => {
      setConfig((current: any) => ({ ...current, ...value }));
      setCatalog(cat || { tts: [], image: [], video: [] });
    }).catch((error: any) => setStatus(error.message || '加载配置失败'));
  }, []);

  function parseList(raw: any) {
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  function toggleList(key: string, provider: string) {
    const set = new Set(parseList(config[key]));
    if (set.has(provider)) set.delete(provider); else set.add(provider);
    setConfig({ ...config, [key]: Array.from(set).join(',') });
  }

  async function save() {
    try {
      // only send editable system keys
      const payload = {
        teaching_media_root: config.teaching_media_root,
        default_tts_provider: config.default_tts_provider,
        default_edge_voice: config.default_edge_voice,
        default_seed_voice: config.default_seed_voice,
        default_image_provider: config.default_image_provider,
        default_video_provider: config.default_video_provider || 'hyperframes',
        hyperframes_quality: config.hyperframes_quality,
        'models.tts.allowlist': config['models.tts.allowlist'],
        'models.image.allowlist': config['models.image.allowlist'],
        'models.video.allowlist': config['models.video.allowlist'] || 'hyperframes'
      };
      const value = await adminService.updateConfig(payload);
      setConfig((current: any) => ({ ...current, ...value }));
      setStatus('系统默认配置已保存：新任务与未开启个人设置的用户生效');
    } catch (error: any) {
      setStatus(error.message || '保存失败');
    }
  }

  const ttsAllow = new Set(parseList(config['models.tts.allowlist']));
  const imageAllow = new Set(parseList(config['models.image.allowlist']));
  const seedVoices = (catalog.tts || []).find((x: any) => x.provider === 'seed')?.voices || [];
  const edgeVoices = (catalog.tts || []).find((x: any) => x.provider === 'edge')?.voices || [];

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="muted">
        系统默认优先级：任务覆盖 &gt; 个人模型设置 &gt; 管理后台系统默认 &gt; `.env/.env.compose`。
        管理员/教师/学生都可在「个人中心 → 模型设置」配置自己的 TTS / 文生图。
      </div>

      <label>Skill 根目录
        <input value={config.teaching_media_root || ''} onChange={event => setConfig({ ...config, teaching_media_root: event.target.value })} />
      </label>

      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>系统默认 · 语音 TTS</h3>
        <div className="grid cols-3">
          <label>默认 TTS Provider
            <select value={config.default_tts_provider || 'edge'} onChange={event => setConfig({ ...config, default_tts_provider: event.target.value })}>
              <option value="edge">Edge TTS</option>
              <option value="seed">火山引擎 Seed TTS 2.0</option>
              <option value="minimax">Minimax</option>
              <option value="say">macOS say</option>
            </select>
          </label>
          <label>Edge 默认音色
            <select value={config.default_edge_voice || 'zh-CN-XiaoxiaoNeural'} onChange={event => setConfig({ ...config, default_edge_voice: event.target.value })}>
              {(edgeVoices.length ? edgeVoices : [
                { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女）' },
                { id: 'zh-CN-YunxiNeural', label: '云希（男）' },
                { id: 'zh-CN-YunyangNeural', label: '云扬（男）' },
                { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女）' }
              ]).map((v: any) => <option key={v.id} value={v.id}>{v.label || v.id}</option>)}
            </select>
          </label>
          <label>Seed 默认音色
            <select value={config.default_seed_voice || 'zh_female_vv_uranus_bigtts'} onChange={event => setConfig({ ...config, default_seed_voice: event.target.value })}>
              {(seedVoices.length ? seedVoices : [{ id: 'zh_female_vv_uranus_bigtts', label: 'VV（女）' }]).map((v: any) => (
                <option key={v.id} value={v.id}>{v.label || v.id}</option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ marginBottom: 6 }}>TTS 开放名单（对学生/教师/管理员统一生效）</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {[
              ['edge', 'Edge'],
              ['seed', 'Seed TTS 2.0'],
              ['minimax', 'Minimax'],
              ['say', 'Say']
            ].map(([id, label]) => (
              <label key={id} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={ttsAllow.has(id)} onChange={() => toggleList('models.tts.allowlist', id)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>系统默认 · 文生图</h3>
        <div className="grid cols-2">
          <label>默认图片 Provider
            <select value={config.default_image_provider || 'volcengine'} onChange={event => setConfig({ ...config, default_image_provider: event.target.value })}>
              <option value="volcengine">火山引擎 Seedream</option>
              <option value="agnes">Agnes</option>
              <option value="mulerun">MuleRun</option>
              <option value="apimart">APImart</option>
              <option value="atlascloud">Atlas Cloud</option>
            </select>
          </label>
          <label>渲染质量（视频）
            <select value={config.hyperframes_quality || 'draft'} onChange={event => setConfig({ ...config, hyperframes_quality: event.target.value })}>
              <option value="draft">Draft（快）</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ marginBottom: 6 }}>文生图开放名单（对学生/教师/管理员统一生效）</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            {[
              ['volcengine', '火山 Seedream'],
              ['agnes', 'Agnes'],
              ['mulerun', 'MuleRun'],
              ['apimart', 'APImart'],
              ['atlascloud', 'Atlas Cloud']
            ].map(([id, label]) => (
              <label key={id} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={imageAllow.has(id)} onChange={() => toggleList('models.image.allowlist', id)} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          模型可用性仍取决于服务端 API Key（如 VOLCENGINE_API_KEY / AGNES_API_KEY）。开放名单只控制是否展示与可选。
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={save}>保存系统默认配置</button>
        <span className="muted">{status}</span>
      </div>
    </div>
  );
}

function AdminReview({ onDone }: { onDone: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const load = () => adminService.pendingCourses().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  return (
    <table>
      <thead><tr><th>标题</th><th>学科</th><th>作者</th><th>作者角色</th><th>队列</th><th>操作</th></tr></thead>
      <tbody>
        {list.map(item => (
          <tr key={item.id}>
            <td>{item.title}</td>
            <td>{item.subject}</td>
            <td>{item.authorName}</td>
            <td>{item.authorRole || '-'}</td>
            <td>{
              item.reviewQueue === 'admin_only' ? (item.authorRole === 'admin' ? '管理员作品/仅管理员' : '教师作品/仅管理员')
                : item.needsAdminFallback ? '无对口教师/管理员兜底'
                : '学生作品/学科教师或管理员'
            }</td>
            <td className="row">
              <button className="btn" onClick={() => adminService.review(item.id, 'approve').then(() => { load(); onDone(); })}>通过</button>
              <button className="btn secondary" onClick={() => adminService.review(item.id, 'reject', '需修改').then(() => { load(); onDone(); })}>驳回</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeacherReview({ onDone }: { onDone: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [done, setDone] = useState<any[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const load = async () => {
    try {
      setList(await teacherService.pending());
      setDone(await teacherService.done());
      setError('');
    } catch (e: any) {
      setList([]);
      setDone([]);
      setError(e.message || '加载失败');
    }
  };
  useEffect(() => { load(); }, []);
  async function act(id: string, action: 'approve' | 'reject') {
    try {
      await teacherService.review(id, action, comment[id] || (action === 'reject' ? '需修改' : ''));
      await load();
      onDone();
    } catch (e: any) {
      setError(e.message || '审核失败');
    }
  }
  return (
    <div className="grid" style={{ gap: 16 }}>
      {error && <p className="muted">{error}</p>}
      <table>
        <thead><tr><th>标题</th><th>学科</th><th>年级</th><th>作者</th><th>意见</th><th>操作</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={6} className="muted">暂无本学科学生待审作品</td></tr>}
          {list.map(item => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.subject}</td>
              <td>{item.grade}</td>
              <td>{item.authorName}</td>
              <td><input value={comment[item.id] || ''} onChange={e => setComment({ ...comment, [item.id]: e.target.value })} placeholder="驳回时必填" /></td>
              <td className="row">
                <button className="btn" onClick={() => act(item.id, 'approve')}>通过</button>
                <button className="btn secondary" onClick={() => act(item.id, 'reject')}>驳回</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3>我的审核记录</h3>
        <table>
          <thead><tr><th>标题</th><th>学科</th><th>动作</th><th>意见</th></tr></thead>
          <tbody>
            {done.map(item => (
              <tr key={item.id}>
                <td>{item.title || item.course_id}</td>
                <td>{item.subject || item.subject_scope || '-'}</td>
                <td>{item.action}</td>
                <td>{item.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function assetLabel(type = '') {
  const t = String(type || '');
  if (t.startsWith('cover')) return '封面';
  if (t.startsWith('infographic')) return '信息图';
  if (t.startsWith('diagram')) return '概念图';
  if (t.startsWith('video')) return '视频';
  if (t.startsWith('storyboard')) return '分镜';
  if (t.startsWith('artifacts')) return '清单';
  return t || '资产';
}

function JobRow({ job, onChanged }: { job: GenerationJob; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadAssets() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (assets) return;
    setLoading(true);
    setError('');
    try {
      setAssets(await jobService.assets(job.id));
    } catch (e: any) {
      setError(e?.message || '加载产物失败');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }

  const images = (assets || []).filter(a => String(a.asset_type || a.type || '').includes('png') || String(a.mime_type || '').startsWith('image/'));

  return (
    <>
      <tr>
        <td>
          <div>{job.topic}</div>
          <div className="muted" style={{ fontSize: 12 }}>{(job as any).outputProfile || (job as any).output_profile || ''}</div>
        </td>
        <td><span className={`badge ${job.status === 'succeeded' ? 'ok' : job.status === 'failed' ? 'bad' : 'run'}`}>{job.status}</span></td>
        <td style={{ minWidth: 140 }}>
          <div className="progress"><span style={{ width: `${job.progress || 0}%` }} /></div>
          <div className="muted">{job.progress || 0}%</div>
        </td>
        <td>{job.currentStage}</td>
        <td className="row">
          {job.videoUrl && <a href={job.videoUrl} target="_blank" rel="noreferrer">看视频</a>}
          {job.coverUrl && <a href={job.coverUrl} target="_blank" rel="noreferrer">封面</a>}
          {job.status === 'succeeded' && <button className="btn secondary" onClick={loadAssets}>{open ? '收起产物' : '产物'}</button>}
          {['queued', 'running'].includes(job.status) && <button className="btn secondary" onClick={() => jobService.cancel(job.id).then(onChanged)}>取消</button>}
          {job.status === 'failed' && <button className="btn secondary" onClick={() => jobService.retry(job.id).then(onChanged)}>重试</button>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            {loading && <div className="muted">加载产物中…</div>}
            {error && <div className="badge bad">{error}</div>}
            {!loading && assets && !assets.length && <div className="muted">暂无产物</div>}
            {!loading && assets && !!assets.length && (
              <div className="grid" style={{ gap: 12 }}>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {assets.map((a: any) => (
                    <a key={a.id || a.url} className="btn secondary" href={a.url || a.contentUrl} target="_blank" rel="noreferrer">
                      {assetLabel(a.asset_type || a.type)}
                    </a>
                  ))}
                </div>
                {!!images.length && (
                  <div className="grid cols-3">
                    {images.map((a: any) => (
                      <div key={`img-${a.id || a.url}`} className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
                        <div className="muted" style={{ marginBottom: 8 }}>{assetLabel(a.asset_type || a.type)}</div>
                        <a href={a.url || a.contentUrl} target="_blank" rel="noreferrer">
                          <img src={a.url || a.contentUrl} alt={assetLabel(a.asset_type || a.type)} style={{ width: '100%', borderRadius: 8 }} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ProfilePanel({ user, subjects, onSaved }: { user: User; subjects: { code: string; name: string }[]; onSaved: (u: User) => void }) {
  const [tab, setTab] = useState<'profile' | 'models'>('profile');
  const [nickname, setNickname] = useState(user.nickname || '');
  const [grade, setGrade] = useState((user as any).grade || (user as any).grade_code || 'grade8');
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(user.teacherSubjects || []);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setNickname(user.nickname || '');
    setGrade((user as any).grade || (user as any).grade_code || 'grade8');
    setTeacherSubjects(user.teacherSubjects || []);
  }, [user]);

  async function saveProfile() {
    try {
      const payload: any = { nickname };
      if (user.role === 'teacher' || user.role === 'admin') payload.teacherSubjects = teacherSubjects;
      if (user.role === 'student') payload.grade = grade;
      const res = await authService.updateProfile(payload);
      onSaved(res.user);
      setStatus('资料已保存');
    } catch (e: any) {
      setStatus(e.message || '保存失败');
    }
  }

  function toggleSubject(code: string) {
    setTeacherSubjects(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row">
        <button className={`btn ${tab === 'profile' ? '' : 'secondary'}`} onClick={() => setTab('profile')}>基本资料</button>
        <button className={`btn ${tab === 'models' ? '' : 'secondary'}`} onClick={() => setTab('models')}>模型设置</button>
      </div>
      {tab === 'profile' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="muted">角色：{user.role} · 邮箱：{user.email}</div>
          <label>昵称<input value={nickname} onChange={e => setNickname(e.target.value)} /></label>
          {user.role === 'student' && (
            <label>年级
              <select value={grade} onChange={e => setGrade(e.target.value)}>
                {GRADES.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
              </select>
            </label>
          )}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div>
              <div className="muted" style={{ marginBottom: 8 }}>授课学科</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {subjects.map(s => (
                  <label key={s.code} className="row" style={{ gap: 4 }}>
                    <input type="checkbox" checked={teacherSubjects.includes(s.code)} onChange={() => toggleSubject(s.code)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <button className="btn" onClick={saveProfile}>保存资料</button>
            <span className="muted">{status}</span>
          </div>
        </div>
      )}
      {tab === 'models' && <ModelSettingsPanel onMessage={setStatus} />}
      {tab === 'models' && status && <div className="muted">{status}</div>}
    </div>
  );
}

function ModelSettingsPanel({ onMessage }: { onMessage?: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<any>({ tts: [], image: [], video: [], outputProfiles: [], policy: {} });
  const [settings, setSettings] = useState<any>({
    ttsEnabled: false, ttsProvider: 'edge', ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsSpeed: 1,
    imageEnabled: false, imageProvider: 'volcengine', imageStyle: 'cozy-handdrawn', imageAspectRatio: '16:9',
    videoEnabled: false, videoProvider: 'hyperframes', videoQuality: 'standard', videoFps: 30,
    preferredOutputProfile: 'teaching_video_full',
    providerCredentials: {} as Record<string, any>
  });
  const [effective, setEffective] = useState<any>(null);
  const [systemDefaults, setSystemDefaults] = useState<any>(null);
  const [status, setStatus] = useState('');

  function emptyCred() {
    return { apiKey: '', apiUrl: '', model: '', apiKeySet: false };
  }

  function providerCred(provider: string) {
    return settings.providerCredentials?.[provider] || emptyCred();
  }

  function setProviderCred(provider: string, patch: Record<string, any>) {
    setSettings((current: any) => ({
      ...current,
      providerCredentials: {
        ...(current.providerCredentials || {}),
        [provider]: {
          ...emptyCred(),
          ...(current.providerCredentials?.[provider] || {}),
          ...patch
        }
      }
    }));
  }

  async function load() {
    setLoading(true);
    try {
      const [cat, me] = await Promise.all([modelSettingsService.catalog(), modelSettingsService.get()]);
      setCatalog(cat);
      const creds = me.settings?.providerCredentials || {};
      setSettings({
        ttsEnabled: !!me.settings?.ttsEnabled,
        ttsProvider: me.settings?.ttsProvider || me.systemDefaults?.ttsProvider || 'edge',
        ttsVoice: me.settings?.ttsVoice || me.systemDefaults?.ttsVoice || 'zh-CN-XiaoxiaoNeural',
        ttsSpeed: me.settings?.ttsSpeed ?? me.systemDefaults?.ttsSpeed ?? 1,
        imageEnabled: !!me.settings?.imageEnabled,
        imageProvider: me.settings?.imageProvider || me.systemDefaults?.imageProvider || 'volcengine',
        imageStyle: me.settings?.imageStyle || me.systemDefaults?.imageStyle || 'cozy-handdrawn',
        imageAspectRatio: me.settings?.imageAspectRatio || me.systemDefaults?.imageAspectRatio || '16:9',
        videoEnabled: !!me.settings?.videoEnabled,
        videoProvider: me.settings?.videoProvider || me.systemDefaults?.videoProvider || 'hyperframes',
        videoQuality: me.settings?.videoQuality || me.systemDefaults?.videoQuality || 'standard',
        videoFps: me.settings?.videoFps ?? me.systemDefaults?.videoFps ?? 30,
        preferredOutputProfile: me.settings?.preferredOutputProfile || me.systemDefaults?.preferredOutputProfile || 'teaching_video_full',
        providerCredentials: creds
      });
      setEffective(me.effective);
      setSystemDefaults(me.systemDefaults);
      setStatus('');
    } catch (e: any) {
      setStatus(e.message || '加载失败');
      onMessage?.(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      // Only send credential fields that user edited; masked apiKey without new input keeps previous server secret.
      const providerCredentials: Record<string, any> = {};
      for (const [provider, cred] of Object.entries(settings.providerCredentials || {})) {
        const c: any = cred || {};
        providerCredentials[provider] = {
          apiKey: String(c.apiKey || '').includes('••••') ? '' : (c.apiKey || ''),
          apiUrl: c.apiUrl || '',
          model: c.model || ''
        };
      }
      const payload = {
        ...settings,
        providerCredentials
      };
      const res = await modelSettingsService.update(payload);
      setSettings({
        ...settings,
        ...res.settings,
        ttsProvider: res.settings?.ttsProvider || settings.ttsProvider,
        ttsVoice: res.settings?.ttsVoice || settings.ttsVoice,
        imageProvider: res.settings?.imageProvider || settings.imageProvider,
        videoProvider: res.settings?.videoProvider || settings.videoProvider,
        videoQuality: res.settings?.videoQuality || settings.videoQuality,
        providerCredentials: res.settings?.providerCredentials || settings.providerCredentials || {}
      });
      setEffective(res.effective);
      setSystemDefaults(res.systemDefaults);
      setStatus('模型设置已保存');
      onMessage?.('模型设置已保存');
      // refresh catalog ready state after saving keys
      const cat = await modelSettingsService.catalog().catch(() => null);
      if (cat) setCatalog(cat);
    } catch (e: any) {
      setStatus(e.message || '保存失败');
      onMessage?.(e.message || '保存失败');
    }
  }

  async function reset() {
    try {
      const res = await modelSettingsService.reset();
      setSettings({
        ttsEnabled: false,
        ttsProvider: res.systemDefaults?.ttsProvider || 'edge',
        ttsVoice: res.systemDefaults?.ttsVoice || 'zh-CN-XiaoxiaoNeural',
        ttsSpeed: res.systemDefaults?.ttsSpeed ?? 1,
        imageEnabled: false,
        imageProvider: res.systemDefaults?.imageProvider || 'volcengine',
        imageStyle: res.systemDefaults?.imageStyle || 'cozy-handdrawn',
        imageAspectRatio: res.systemDefaults?.imageAspectRatio || '16:9',
        videoEnabled: false,
        videoProvider: res.systemDefaults?.videoProvider || 'hyperframes',
        videoQuality: res.systemDefaults?.videoQuality || 'standard',
        videoFps: res.systemDefaults?.videoFps ?? 30,
        preferredOutputProfile: res.systemDefaults?.preferredOutputProfile || 'teaching_video_full',
        providerCredentials: {}
      });
      setEffective(res.effective);
      setSystemDefaults(res.systemDefaults);
      setStatus('已恢复系统默认');
      onMessage?.('已恢复系统默认');
    } catch (e: any) {
      setStatus(e.message || '重置失败');
      onMessage?.(e.message || '重置失败');
    }
  }

  if (loading) return <div className="muted">加载模型设置…</div>;

  const activeTts = (catalog.tts || []).find((x: any) => x.provider === (settings.ttsProvider || 'edge'));
  const activeImage = (catalog.image || []).find((x: any) => x.provider === (settings.imageProvider || 'volcengine'));
  const activeTtsVoices = activeTts?.voices || [];
  const paidTts = !!activeTts?.paid;
  const paidImage = !!activeImage?.paid;

  function CredentialFields({ provider, meta }: { provider: string; meta: any }) {
    if (!provider || !meta?.paid) return null;
    const cred = providerCred(provider);
    const fields = meta.credentialFields || [
      { key: 'apiKey', label: 'API Key', required: true },
      { key: 'apiUrl', label: 'API URL', required: false },
      { key: 'model', label: '模型名称', required: false }
    ];
    return (
      <div className="card" style={{ boxShadow: 'none', border: '1px dashed var(--line-strong)', marginTop: 10, background: 'var(--surface-deep)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>{meta.label || provider} 凭证</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {cred.apiKeySet ? '已保存 API Key' : '未配置 API Key'}
            {meta.credentialSource === 'env' ? ' · 当前可用 .env' : ''}
            {meta.ready ? ' · 可用' : ' · 不可用'}
          </span>
        </div>
        <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
          Edge TTS / say 免费无需 Key。收费 TTS 与文生图：教师/学生必须在此填写自己的 API Key（及可选 URL/模型名）后才能使用。
          管理员可不填，默认读取服务器 `.env` / `.env.compose`。
        </div>
        <div className="grid cols-3">
          {fields.map((field: any) => (
            <label key={field.key}>
              {field.label}{field.required ? ' *' : ''}
              <input
                type={field.key === 'apiKey' ? 'password' : 'text'}
                autoComplete="off"
                placeholder={
                  field.key === 'apiKey'
                    ? (cred.apiKeySet ? '已保存，留空则保持不变' : (field.placeholder || '请输入 API Key'))
                    : (meta.defaults?.[field.key] || field.placeholder || '')
                }
                value={field.key === 'apiKey' ? (String(cred.apiKey || '').includes('••••') ? '' : (cred.apiKey || '')) : (cred[field.key] || '')}
                onChange={e => setProviderCred(provider, { [field.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {!meta.ready && (
          <div className="muted" style={{ marginTop: 8, color: 'var(--warn)' }}>
            {meta.reason || '请先完成 API Key 配置'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="muted">
        优先级：任务覆盖 &gt; 个人设置 &gt; 系统默认 / .env。当前生效：
        TTS {effective?.ttsProvider}/{effective?.ttsVoice} · 图片 {effective?.imageProvider} · 视频 {effective?.videoProvider}/{effective?.videoQuality}
      </div>
      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)', background: 'var(--surface-warm)' }}>
        <strong>计费说明</strong>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          免费：Edge TTS、macOS say、HyperFrames 本地渲染。收费：Seed TTS / Minimax / 全部文生图模型。
          教师与学生使用收费模型前，必须在个人中心配置对应 API Key、可选 API URL 与模型名称；管理员默认可直接使用服务器环境变量。
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>语音 TTS</h3>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={!!settings.ttsEnabled} onChange={e => setSettings({ ...settings, ttsEnabled: e.target.checked })} />
          启用个人 TTS 设置
        </label>
        <div className="grid cols-3" style={{ marginTop: 8 }}>
          <label>Provider
            <select disabled={!settings.ttsEnabled} value={settings.ttsProvider || 'edge'} onChange={e => setSettings({ ...settings, ttsProvider: e.target.value })}>
              {(catalog.tts || []).map((item: any) => (
                <option key={item.provider} value={item.provider}>
                  {item.label}{item.ready ? '' : '（待配置）'}
                </option>
              ))}
            </select>
          </label>
          <label>音色
            <select disabled={!settings.ttsEnabled || !['edge','seed'].includes(settings.ttsProvider || '')} value={settings.ttsVoice || ''} onChange={e => setSettings({ ...settings, ttsVoice: e.target.value })}>
              {activeTtsVoices.map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}
              {!activeTtsVoices.length && <option value={settings.ttsVoice || ''}>{settings.ttsVoice || '默认'}</option>}
            </select>
          </label>
          <label>语速
            <input type="number" min={0.5} max={2} step={0.1} disabled={!settings.ttsEnabled} value={settings.ttsSpeed ?? 1} onChange={e => setSettings({ ...settings, ttsSpeed: Number(e.target.value) })} />
          </label>
        </div>
        {settings.ttsEnabled && paidTts && <CredentialFields provider={settings.ttsProvider} meta={activeTts} />}
        {!settings.ttsEnabled && systemDefaults && <div className="muted">跟随系统：{systemDefaults.ttsProvider} / {systemDefaults.ttsVoice}</div>}
      </div>

      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>文生图片</h3>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={!!settings.imageEnabled} onChange={e => setSettings({ ...settings, imageEnabled: e.target.checked })} />
          启用个人图片模型设置
        </label>
        <div className="grid cols-3" style={{ marginTop: 8 }}>
          <label>Provider
            <select disabled={!settings.imageEnabled} value={settings.imageProvider || 'volcengine'} onChange={e => setSettings({ ...settings, imageProvider: e.target.value })}>
              {(catalog.image || []).map((item: any) => (
                <option key={item.provider} value={item.provider}>
                  {item.label}{item.ready ? '' : '（待配置）'}
                </option>
              ))}
            </select>
          </label>
          <label>默认风格
            <select disabled={!settings.imageEnabled} value={settings.imageStyle || 'cozy-handdrawn'} onChange={e => setSettings({ ...settings, imageStyle: e.target.value })}>
              <option value="cozy-handdrawn">cozy-handdrawn</option>
              <option value="notebook">notebook</option>
              <option value="infographic">infographic</option>
              <option value="executive-tech">executive-tech</option>
            </select>
          </label>
          <label>比例偏好
            <select disabled={!settings.imageEnabled} value={settings.imageAspectRatio || '16:9'} onChange={e => setSettings({ ...settings, imageAspectRatio: e.target.value })}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="3:4">3:4</option>
              <option value="1:1">1:1</option>
            </select>
          </label>
        </div>
        {settings.imageEnabled && paidImage && <CredentialFields provider={settings.imageProvider} meta={activeImage} />}
        {!settings.imageEnabled && systemDefaults && <div className="muted">跟随系统：{systemDefaults.imageProvider}</div>}
      </div>

      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>文生视频 / 教学动画</h3>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={!!settings.videoEnabled} onChange={e => setSettings({ ...settings, videoEnabled: e.target.checked })} />
          启用个人视频渲染设置
        </label>
        <div className="grid cols-3" style={{ marginTop: 8 }}>
          <label>引擎
            <select disabled={!settings.videoEnabled} value={settings.videoProvider || 'hyperframes'} onChange={e => setSettings({ ...settings, videoProvider: e.target.value })}>
              {(catalog.video || []).map((item: any) => (
                <option key={item.provider} value={item.provider}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>质量档位
            <select disabled={!settings.videoEnabled} value={settings.videoQuality || 'standard'} onChange={e => setSettings({ ...settings, videoQuality: e.target.value })}>
              <option value="draft">draft（快）</option>
              <option value="standard">standard</option>
              <option value="high">high</option>
            </select>
          </label>
          <label>默认输出档位
            <select value={settings.preferredOutputProfile || 'teaching_video_full'} onChange={e => setSettings({ ...settings, preferredOutputProfile: e.target.value })}>
              {(catalog.outputProfiles || ['teaching_video_full']).map((p: string) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {!settings.videoEnabled && systemDefaults && <div className="muted">跟随系统：{systemDefaults.videoProvider} / {systemDefaults.videoQuality}</div>}
      </div>

      <div className="row">
        <button className="btn" onClick={save}>保存模型设置</button>
        <button className="btn secondary" onClick={reset}>恢复系统默认</button>
        <span className="muted">{status}</span>
      </div>
    </div>
  );
}


function KnowledgeSelector({
  subjects,
  grades,
  value,
  onChange
}: {
  subjects: { code: string; name: string }[];
  grades: { code: string; name: string }[];
  value: { subject: string; grade: string; chapter: string; topic: string };
  onChange: (patch: Partial<{ subject: string; grade: string; chapter: string; topic: string }>) => void;
}) {
  const [points, setPoints] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualChapter, setManualChapter] = useState(false);
  const [manualTopic, setManualTopic] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    catalogService.knowledgePoints({
      subject: value.subject,
      grade: value.grade,
      q: keyword || undefined,
      limit: '200'
    }).then((rows) => {
      if (cancelled) return;
      const list = Array.isArray(rows) ? rows : [];
      setPoints(list);
      setChapters([...new Set(list.map((p: any) => p.chapter).filter(Boolean))]);
    }).catch(() => {
      if (!cancelled) {
        setPoints([]);
        setChapters([]);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [value.subject, value.grade, keyword]);

  const filteredTopics = points.filter((p) => !value.chapter || p.chapter === value.chapter);

  function selectPoint(point: any) {
    onChange({
      subject: point.subjectCode || value.subject,
      grade: point.gradeCode || value.grade,
      chapter: point.chapter || '',
      topic: point.topic || '',
      learningGoals: Array.isArray(point.learningGoals) ? point.learningGoals : [],
      animationPack: point.animationPack || undefined
    } as any);
    setManualChapter(false);
    setManualTopic(false);
  }

  return (
    <>
      <label>学科
        <select
          value={value.subject}
          onChange={(e) => {
            onChange({ subject: e.target.value, chapter: '', topic: '' });
            setManualChapter(false);
            setManualTopic(false);
          }}
        >
          {subjects.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </label>
      <label>年级
        <select value={value.grade} onChange={(e) => onChange({ grade: e.target.value })}>
          {grades.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
        </select>
      </label>
      <label>关键字搜索知识点
        <input
          value={keyword}
          placeholder="输入关键字匹配，如 守恒 / 等高线 / 1919"
          onChange={(e) => setKeyword(e.target.value)}
        />
      </label>
      <label>章节
        {manualChapter || chapters.length === 0 ? (
          <input
            value={value.chapter}
            placeholder={loading ? '加载章节中…' : '可手工输入章节'}
            onChange={(e) => onChange({ chapter: e.target.value })}
          />
        ) : (
          <select
            value={value.chapter}
            onChange={(e) => {
              if (e.target.value === '__manual__') {
                setManualChapter(true);
                return;
              }
              onChange({ chapter: e.target.value, topic: '' });
              setManualTopic(false);
            }}
          >
            <option value="">请选择章节</option>
            {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__manual__">手工输入章节…</option>
          </select>
        )}
      </label>
      <label>知识点 / 课程主题
        {manualTopic || filteredTopics.length === 0 ? (
          <input
            value={value.topic}
            placeholder={loading ? '加载知识点中…' : '可手工输入主题'}
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        ) : (
          <select
            value={filteredTopics.find((p) => p.topic === value.topic)?.id || ''}
            onChange={(e) => {
              if (e.target.value === '__manual__') {
                setManualTopic(true);
                return;
              }
              const point = filteredTopics.find((p) => p.id === e.target.value);
              if (point) selectPoint(point);
            }}
          >
            <option value="">请选择知识点</option>
            {filteredTopics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic}{p.summary ? ` — ${String(p.summary).slice(0, 18)}` : ''}
              </option>
            ))}
            <option value="__manual__">手工输入主题…</option>
          </select>
        )}
      </label>
      {!!keyword && filteredTopics.length > 0 && (
        <div className="card" style={{ padding: 10, background: 'var(--surface-deep)' }}>
          <div className="muted" style={{ marginBottom: 8 }}>匹配结果（点击填入）{loading ? ' …' : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {filteredTopics.slice(0, 12).map((p) => (
              <button key={p.id} type="button" className="btn secondary" style={{ fontSize: 13 }} onClick={() => selectPoint(p)}>
                {p.topic}
              </button>
            ))}
          </div>
        </div>
      )}
      {(() => {
        const selected = points.find((p) => p.topic === value.topic && (!value.chapter || p.chapter === value.chapter));
        if (!selected) return null;
        return (
          <div className="muted" style={{ fontSize: 13 }}>
            已选知识点元数据：动画包 <strong>{selected.animationPack || '-'}</strong>
            {!!(selected.learningGoals || []).length && <> · 学习目标 {(selected.learningGoals || []).slice(0, 3).join('；')}</>}
          </div>
        );
      })()}
    </>
  );
}

function AdminKnowledge() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [status, setStatus] = useState('');
  const [showSubjectPanel, setShowSubjectPanel] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', sortOrder: 100, enabled: true });
  const emptyPointForm = {
    id: '',
    subjectCode: 'math',
    gradeCode: 'grade8',
    chapter: '',
    topic: '',
    summary: '',
    keywords: '',
    learningGoals: '',
    animationPack: 'math',
    sortOrder: 100,
    enabled: true
  };
  const [pointForm, setPointForm] = useState<any>(emptyPointForm);
  const [animationPacks, setAnimationPacks] = useState<{ code: string; name: string }[]>([
    { code: 'energy', name: '能量守恒动画包' },
    { code: 'sound', name: '声现象动画包' },
    { code: 'math', name: '数学示意动画包' },
    { code: 'light', name: '光学动画包' },
    { code: 'force', name: '力学/简单机械动画包' },
    { code: 'electric', name: '电路电学动画包' },
    { code: 'biology', name: '生物学动画包' },
    { code: 'chemistry', name: '化学动画包' },
    { code: 'geography', name: '地理动画包' },
    { code: 'history', name: '历史时间轴动画包' },
    { code: 'generic', name: '通用动画包' }
  ]);

  async function reload() {
    const params: Record<string, string> = {};
    if (filterSubject) params.subject = filterSubject;
    if (filterQ) params.q = filterQ;
    const [s, p, packs] = await Promise.all([
      adminService.listSubjects(),
      adminService.listKnowledgePoints(params),
      catalogService.animationPacks().catch(() => animationPacks)
    ]);
    setSubjects(s || []);
    setPoints(p || []);
    if (Array.isArray(packs) && packs.length) setAnimationPacks(packs);
  }

  useEffect(() => {
    reload().catch((e: any) => setStatus(e.message || '加载失败'));
  }, []);

  useEffect(() => {
    // 筛选条件变化时自动刷新列表
    reload().catch((e: any) => setStatus(e.message || '刷新失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubject]);

  function focusEditor(message = '') {
    if (message) setStatus(message);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function beginCreate() {
    setPointForm({
      ...emptyPointForm,
      subjectCode: filterSubject || emptyPointForm.subjectCode,
      gradeCode: emptyPointForm.gradeCode
    });
    focusEditor('请在右侧填写新知识点');
  }

  function beginEdit(p: any) {
    setPointForm({
      id: p.id,
      subjectCode: p.subjectCode,
      gradeCode: p.gradeCode || '',
      chapter: p.chapter,
      topic: p.topic,
      summary: p.summary || '',
      keywords: (p.keywords || []).join(','),
      learningGoals: (p.learningGoals || []).join('\n'),
      animationPack: p.animationPack || 'generic',
      sortOrder: p.sortOrder || 100,
      enabled: p.enabled !== false
    });
    focusEditor(`正在编辑：${p.topic}`);
  }

  function cancelEdit() {
    setPointForm({ ...emptyPointForm, subjectCode: filterSubject || emptyPointForm.subjectCode });
    setStatus('已取消编辑');
  }

  async function saveSubject() {
    try {
      setStatus('保存学科中…');
      await adminService.upsertSubject({
        code: subjectForm.code,
        name: subjectForm.name,
        sortOrder: Number(subjectForm.sortOrder) || 100,
        enabled: subjectForm.enabled
      });
      setSubjectForm({ code: '', name: '', sortOrder: 100, enabled: true });
      await reload();
      setStatus('学科已保存');
    } catch (e: any) {
      setStatus(e.message || '保存学科失败');
    }
  }

  async function toggleSubject(row: any) {
    try {
      await adminService.updateSubject(row.code, { enabled: !row.enabled });
      await reload();
    } catch (e: any) {
      setStatus(e.message || '更新学科失败');
    }
  }

  async function savePoint() {
    try {
      setStatus(pointForm.id ? '更新知识点中…' : '新增知识点中…');
      const payload = {
        subjectCode: pointForm.subjectCode,
        gradeCode: pointForm.gradeCode || null,
        chapter: pointForm.chapter,
        topic: pointForm.topic,
        summary: pointForm.summary,
        keywords: String(pointForm.keywords || '').split(/[,，、\s]+/).map((s: string) => s.trim()).filter(Boolean),
        learningGoals: String(pointForm.learningGoals || '').split(/[\n;；]+/).map((s: string) => s.trim()).filter(Boolean),
        animationPack: pointForm.animationPack || 'generic',
        sortOrder: Number(pointForm.sortOrder) || 100,
        enabled: pointForm.enabled !== false
      };
      if (pointForm.id) await adminService.updateKnowledgePoint(pointForm.id, payload);
      else await adminService.createKnowledgePoint(payload);
      setPointForm({
        ...emptyPointForm,
        subjectCode: pointForm.subjectCode || emptyPointForm.subjectCode,
        animationPack: pointForm.animationPack || emptyPointForm.animationPack
      });
      await reload();
      setStatus('知识点已保存');
      focusEditor('知识点已保存，可继续新增');
    } catch (e: any) {
      setStatus(e.message || '保存知识点失败');
    }
  }

  async function removePoint(id: string) {
    if (!window.confirm('确认删除该知识点？')) return;
    try {
      await adminService.deleteKnowledgePoint(id);
      if (pointForm.id === id) cancelEdit();
      await reload();
      setStatus('已删除');
    } catch (e: any) {
      setStatus(e.message || '删除失败');
    }
  }

  async function applySearch() {
    try {
      await reload();
      setStatus(filterQ ? `已按关键字筛选：${filterQ}` : '已刷新列表');
    } catch (e: any) {
      setStatus(e.message || '刷新失败');
    }
  }

  const editing = Boolean(pointForm.id);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="muted">左侧浏览知识点，右侧直接编辑。点击「编辑」会把内容填入右侧并定位到表单。</div>
        <div className="row">
          <button className="btn secondary" onClick={() => setShowSubjectPanel((v) => !v)}>
            {showSubjectPanel ? '收起学科维护' : '维护学科大类'}
          </button>
          <button className="btn" onClick={beginCreate}>新增知识点</button>
        </div>
      </div>

      {status && (
        <div className="card" style={{ padding: 12, background: editing ? 'var(--surface-warm)' : 'var(--surface-active)', borderColor: editing ? 'var(--accent)' : undefined }}>
          {status}
        </div>
      )}

      {showSubjectPanel && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 8 }}>学科大类维护</h3>
          <div className="grid cols-2">
            <div className="grid" style={{ gap: 8 }}>
              <label>code（如 physics）<input value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} /></label>
              <label>名称<input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} /></label>
              <label>排序<input type="number" value={subjectForm.sortOrder} onChange={(e) => setSubjectForm({ ...subjectForm, sortOrder: Number(e.target.value) })} /></label>
              <label><input type="checkbox" checked={subjectForm.enabled} onChange={(e) => setSubjectForm({ ...subjectForm, enabled: e.target.checked })} /> 启用</label>
              <button className="btn" onClick={saveSubject}>新增/更新学科</button>
            </div>
            <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto' }}>
              {subjects.map((s) => (
                <div key={s.code} className="card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <strong>{s.name}</strong> <span className="muted">({s.code})</span>
                    <div className="muted">排序 {s.sortOrder} · {s.enabled ? '启用' : '停用'}</div>
                  </div>
                  <button className="btn secondary" onClick={() => toggleSubject(s)}>{s.enabled ? '停用' : '启用'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="knowledge-layout">
        <div className="card" style={{ padding: 16, minWidth: 0 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">全部学科</option>
              {subjects.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <input
              value={filterQ}
              placeholder="搜索知识点/章节/关键词"
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button className="btn secondary" onClick={applySearch}>搜索</button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在从 KNOWLEDGE_PACKS 同步…');
                  const summary = await adminService.syncKnowledgePacks({ overwrite: true });
                  await reload();
                  setStatus(`同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个动画知识包`);
                } catch (e: any) {
                  setStatus(e.message || '同步失败');
                }
              }}
            >
              一键同步动画知识包
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步 ChemAIForge 化学知识库（102）…');
                  const summary = await adminService.syncChemAIForgeKnowledge({ overwrite: true });
                  setFilterSubject('chemistry');
                  await reload();
                  setStatus(`ChemAIForge 同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || 'ChemAIForge 同步失败');
                }
              }}
            >
              同步 ChemAIForge 化学(102)
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步初中语文知识库…');
                  const summary = await adminService.syncJuniorChineseKnowledge({ overwrite: true });
                  setFilterSubject('chinese');
                  await reload();
                  setStatus(`初中语文同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || '初中语文同步失败');
                }
              }}
            >
              同步初中语文
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步初中英语知识库…');
                  const summary = await adminService.syncJuniorEnglishKnowledge({ overwrite: true });
                  setFilterSubject('english');
                  await reload();
                  setStatus(`初中英语同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || '初中英语同步失败');
                }
              }}
            >
              同步初中英语
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步初中历史知识库…');
                  const summary = await adminService.syncJuniorHistoryKnowledge({ overwrite: true });
                  setFilterSubject('history');
                  await reload();
                  setStatus(`初中历史同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || '初中历史同步失败');
                }
              }}
            >
              同步初中历史
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步初中地理知识库…');
                  const summary = await adminService.syncJuniorGeographyKnowledge({ overwrite: true });
                  setFilterSubject('geography');
                  await reload();
                  setStatus(`初中地理同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || '初中地理同步失败');
                }
              }}
            >
              同步初中地理
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在同步初中政治/道德与法治知识库…');
                  const summary = await adminService.syncJuniorPoliticsKnowledge({ overwrite: true });
                  setFilterSubject('politics');
                  await reload();
                  setStatus(`初中政治同步完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}，共 ${summary.total} 个`);
                } catch (e: any) {
                  setStatus(e.message || '初中政治同步失败');
                }
              }}
            >
              同步初中政治
            </button>
          </div>

          <div className="muted" style={{ marginBottom: 8 }}>共 {points.length} 条知识点</div>
          <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflow: 'auto', paddingRight: 4 }}>
            {points.map((p) => {
              const active = pointForm.id === p.id;
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 12,
                    margin: 0,
                    borderColor: active ? 'var(--accent)' : undefined,
                    boxShadow: active ? '0 0 0 2px rgba(245, 158, 11, 0.2)' : undefined,
                    background: active ? 'var(--surface-warm)' : undefined
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <strong>{p.topic}</strong>
                        {active && <span className="badge run">编辑中</span>}
                        {!p.enabled && <span className="badge bad">已停用</span>}
                      </div>
                      <div className="muted">{p.subjectCode} · {p.gradeCode || '不限年级'} · {p.chapter}</div>
                      {p.summary && <div className="muted" style={{ marginTop: 4 }}>{p.summary}</div>}
                      {!!(p.keywords || []).length && <div className="muted">关键词：{(p.keywords || []).join('、')}</div>}
                      <div className="muted">动画包：{p.animationPack || '-'}{p.packKey ? ` · pack:${p.packKey}` : ''}</div>
                      {!!(p.learningGoals || []).length && <div className="muted">学习目标：{(p.learningGoals || []).join('；')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <button className="btn" onClick={() => beginEdit(p)}>编辑</button>
                      <button className="btn secondary" onClick={() => removePoint(p.id)}>删除</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!points.length && <div className="muted">暂无知识点，可点右上角「新增知识点」或「一键同步动画知识包」。</div>}
          </div>
        </div>

        <div
          ref={editorRef}
          className="card"
          style={{
            padding: 16,
            position: 'sticky',
            top: 16,
            alignSelf: 'start',
            borderColor: editing ? 'var(--accent)' : undefined,
            boxShadow: editing ? '0 0 0 2px rgba(245, 158, 11, 0.18)' : undefined
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{editing ? '编辑知识点' : '新增知识点'}</h3>
              <div className="muted">{editing ? `当前：${pointForm.topic || pointForm.id}` : '填写后点保存，会进入左侧列表'}</div>
            </div>
            {editing && <button className="btn secondary" onClick={cancelEdit}>取消编辑</button>}
          </div>

          <div className="grid" style={{ gap: 8 }}>
            <label>学科
              <select value={pointForm.subjectCode} onChange={(e) => setPointForm({ ...pointForm, subjectCode: e.target.value })}>
                {(subjects.length ? subjects : [{ code: 'math', name: '数学' }]).map((s: any) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>年级
              <select value={pointForm.gradeCode || ''} onChange={(e) => setPointForm({ ...pointForm, gradeCode: e.target.value })}>
                <option value="">不限年级</option>
                {GRADES.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
              </select>
            </label>
            <label>章节<input value={pointForm.chapter} onChange={(e) => setPointForm({ ...pointForm, chapter: e.target.value })} /></label>
            <label>知识点<input value={pointForm.topic} onChange={(e) => setPointForm({ ...pointForm, topic: e.target.value })} /></label>
            <label>摘要<textarea value={pointForm.summary} onChange={(e) => setPointForm({ ...pointForm, summary: e.target.value })} /></label>
            <label>关键词（逗号分隔）<input value={pointForm.keywords} onChange={(e) => setPointForm({ ...pointForm, keywords: e.target.value })} /></label>
            <label>学习目标（每行一条）
              <textarea
                value={pointForm.learningGoals}
                onChange={(e) => setPointForm({ ...pointForm, learningGoals: e.target.value })}
                placeholder={'理解定义\n会画示意图\n能做基础题'}
              />
            </label>
            <label>关联动画包
              <select value={pointForm.animationPack || 'generic'} onChange={(e) => setPointForm({ ...pointForm, animationPack: e.target.value })}>
                {animationPacks.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label>排序<input type="number" value={pointForm.sortOrder} onChange={(e) => setPointForm({ ...pointForm, sortOrder: Number(e.target.value) })} /></label>
            <label><input type="checkbox" checked={pointForm.enabled !== false} onChange={(e) => setPointForm({ ...pointForm, enabled: e.target.checked })} /> 启用</label>
            <div className="row">
              <button className="btn" onClick={savePoint}>{editing ? '保存修改' : '创建知识点'}</button>
              {editing && <button className="btn secondary" onClick={cancelEdit}>取消</button>}
              {!editing && <button className="btn secondary" onClick={beginCreate}>清空表单</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminUsers({ subjects }: { subjects: { code: string; name: string }[] }) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  const load = async () => {
    try {
      const rows = await adminService.listUsers(q ? { q } : {});
      setList(rows);
      const next: Record<string, any> = {};
      rows.forEach((u: any) => {
        next[u.id] = {
          role: u.role,
          status: u.status,
          teacherSubjects: u.teacherSubjects || [],
          nickname: u.nickname
        };
      });
      setDrafts(next);
      setStatus('');
    } catch (e: any) {
      setStatus(e.message || '加载失败');
    }
  };

  useEffect(() => { load(); }, []);

  function toggleSubject(userId: string, code: string) {
    setDrafts(prev => {
      const cur = prev[userId] || { teacherSubjects: [] };
      const set = new Set(cur.teacherSubjects || []);
      if (set.has(code)) set.delete(code); else set.add(code);
      return { ...prev, [userId]: { ...cur, teacherSubjects: [...set] } };
    });
  }

  async function save(userId: string) {
    try {
      const d = drafts[userId];
      await adminService.updateUser(userId, {
        nickname: d.nickname,
        role: d.role,
        status: d.status,
        teacherSubjects: d.role === 'teacher' ? d.teacherSubjects : []
      });
      setStatus('已保存');
      await load();
    } catch (e: any) {
      setStatus(e.message || '保存失败');
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row">
        <input placeholder="搜索邮箱/昵称" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn secondary" onClick={load}>查询</button>
        <span className="muted">{status}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>昵称</th><th>邮箱</th><th>角色</th><th>状态</th><th>教师学科</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map(u => {
            const d = drafts[u.id] || u;
            return (
              <tr key={u.id}>
                <td><input value={d.nickname || ''} onChange={e => setDrafts({ ...drafts, [u.id]: { ...d, nickname: e.target.value } })} /></td>
                <td>{u.email}</td>
                <td>
                  <select value={d.role} onChange={e => setDrafts({ ...drafts, [u.id]: { ...d, role: e.target.value } })}>
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <select value={d.status} onChange={e => setDrafts({ ...drafts, [u.id]: { ...d, status: e.target.value } })}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </td>
                <td>
                  {d.role === 'teacher' ? (
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      {subjects.map(s => (
                        <label key={s.code} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input type="checkbox" checked={(d.teacherSubjects || []).includes(s.code)} onChange={() => toggleSubject(u.id, s.code)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  ) : <span className="muted">-</span>}
                </td>
                <td><button className="btn" onClick={() => save(u.id)}>保存</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
