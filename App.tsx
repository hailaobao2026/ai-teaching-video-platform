import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  BookOpen,
  CircleUserRound,
  Clapperboard,
  ClipboardCheck,
  Download,
  GraduationCap,
  Home as HomeIcon,
  Library,
  ListChecks,
  LogIn,
  LogOut,
  Maximize2,
  MessageCircle,
  MonitorPlay,
  Send,
  Settings,
  Sparkles,
  WandSparkles,
  WifiOff
} from 'lucide-react';
import type { AppView, AssistantResponse, CourseItem, GenerationJob, RuralPilotRecord, RuralPilotSummary, User } from './types';
import { adminService, assistantService, authService, catalogService, courseService, jobService, modelSettingsService, ruralPilotService, teacherService } from './services/api';
import { RURAL_LESSON_PRESETS } from './ruralPresets';

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
    videoQuality: '',
    textbookEdition: '人教版',
    classroomScenario: 'lesson-prep',
    lowBandwidth: true
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
    { id: 'assistant', label: 'AI 课堂助教', icon: MessageCircle },
    { id: 'create', label: '一键备课', icon: WandSparkles },
    { id: 'classroom', label: '课堂播放', icon: MonitorPlay },
    { id: 'rural-pilot', label: '试点记录', icon: ClipboardCheck },
    { id: 'jobs', label: '我的任务', icon: ListChecks },
    { id: 'courses', label: '课程广场', icon: Library },
    { id: 'my-courses', label: '我的课程', icon: BookOpen },
    { id: 'profile', label: '个人中心', icon: CircleUserRound },
    { id: 'teacher-review', label: '待我审核', icon: ClipboardCheck },
    { id: 'admin', label: '管理后台', icon: Settings },
    { id: 'admin-knowledge', label: '学科与知识点', icon: GraduationCap }
  ] as const).filter(item => {
    if (item.id === 'admin' || item.id === 'admin-knowledge') return user?.role === 'admin';
    if (item.id === 'teacher-review' || item.id === 'rural-pilot') return user?.role === 'teacher' || user?.role === 'admin';
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
      setMessage('请先登录后再提交生成任务（左侧“登录/注册”）');
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

  function applyLessonPreset(preset: (typeof RURAL_LESSON_PRESETS)[number]) {
    setForm((current) => ({
      ...current,
      ...preset.form,
      learningGoals: [...preset.form.learningGoals]
    }));
    setPreflight(null);
    setMessage(`已载入乡村课堂模板：${preset.title}`);
    setView('create');
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Clapperboard size={22} /></span>
          <span className="brand-copy">
            <strong>大山里的 AI 课</strong>
            <span>乡村课堂 AI 助教</span>
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
                <div className="eyebrow"><Sparkles size={16} aria-hidden="true" /> 乡村课堂 AI 助教</div>
                <h1>让乡村教师更快备课，让每个孩子都能听懂</h1>
                <p className="muted">
                  自动完成分镜、配音、渲染，并按课程分类管理上架。
                  教师保留教学判断，AI 负责准备材料和解释难点。
                </p>
                <div className="row" style={{ marginTop: 16 }}>
                  <button className="btn" onClick={() => setView('assistant')}><MessageCircle size={18} aria-hidden="true" />打开 AI 助教</button>
                  <button className="btn secondary" onClick={() => setView('create')}><WandSparkles size={18} aria-hidden="true" />一键备课</button>
                </div>
              </div>
              <div className="stat">
                <div className="stat-label"><WifiOff size={17} aria-hidden="true" />乡村适配</div>
                <strong>低带宽优先</strong>
                <div style={{ opacity: 0.85, marginTop: 8 }}>本地知识库兜底 · 可下载视频 · 大屏课堂模式</div>
              </div>
            </div>
            <div className="grid cols-3 feature-grid">
              <div className="card feature-step"><span>01</span><h3>随时提问</h3><p className="muted">按学科、年级和教材上下文解释知识难点</p></div>
              <div className="card feature-step"><span>02</span><h3>一键备课</h3><p className="muted">乡村生活化案例 + 分镜 + 配音 + 教学动画</p></div>
              <div className="card feature-step"><span>03</span><h3>课堂使用</h3><p className="muted">大屏播放、暂停提问、视频下载后离线授课</p></div>
            </div>
            <div className="section-heading">
              <div><span className="eyebrow">示范备课场景</span><h2>三类模板直接开始</h2></div>
              <span className="muted">模板用于演示，真实课堂效果需通过试点数据验证</span>
            </div>
            <div className="grid cols-3">
              {RURAL_LESSON_PRESETS.map((preset) => (
                <button className="card preset-card" key={preset.id} onClick={() => applyLessonPreset(preset)}>
                  <strong>{preset.title}</strong>
                  <span>{preset.description}</span>
                  <em>载入模板 →</em>
                </button>
              ))}
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
              <p className="muted">支持管理员 / 教师 / 学生登录。管理员账号由系统初始化，不走公开注册</p>
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

        {view === 'assistant' && (
          <AssistantView
            user={user}
            subjects={subjectOptions.length ? subjectOptions : SUBJECTS}
            grades={gradeOptions.length ? gradeOptions : GRADES}
            onLogin={() => setView('login')}
          />
        )}

        {view === 'classroom' && (
          <ClassroomView courses={courses} onCreate={() => setView('create')} />
        )}

        {view === 'rural-pilot' && (
          <RuralPilotView
            user={user}
            courses={myCourses}
            subjects={subjectOptions.length ? subjectOptions : SUBJECTS}
            grades={gradeOptions.length ? gradeOptions : GRADES}
            onLogin={() => setView('login')}
          />
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
                <div className="grid cols-3">
                  <label>教材版本
                    <select value={form.textbookEdition} onChange={e => setForm({ ...form, textbookEdition: e.target.value })}>
                      <option value="人教版">人教版</option>
                      <option value="部编版">部编版</option>
                      <option value="北师大版">北师大版</option>
                      <option value="苏教版">苏教版</option>
                      <option value="校本教材">校本教材</option>
                    </select>
                  </label>
                  <label>课堂场景
                    <select value={form.classroomScenario} onChange={e => setForm({ ...form, classroomScenario: e.target.value })}>
                      <option value="lesson-prep">课前备课</option>
                      <option value="in-class">课堂讲解</option>
                      <option value="review">课后复习</option>
                      <option value="mixed-grade">复式/混龄课堂</option>
                    </select>
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={form.lowBandwidth} onChange={e => setForm({ ...form, lowBandwidth: e.target.checked, videoQuality: e.target.checked ? 'draft' : form.videoQuality })} />
                    低带宽优先                  </label>
                </div>
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
                      <option value="qwenimage">qwenimage (Alibaba Qwen-Image)</option>
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
                <li>若选“视频 + 信息图 + 封面”：再串行调用文生图 3 次（信息图/封面/概念图）</li>
                <li>按课程分类入库，可送审分享</li>
              </ol>
              {form.outputProfile === 'package_all' && (
                <p className="muted">该模式 = 完整教学视频 + 3 张生图，耗时约为「仅视频」的 1.3~2 倍，主要卡在 HyperFrames 渲染中 Agnes 生图排队</p>
              )}
            </div>
          </div>
        )}

        {view === 'jobs' && (
          <div className="card">
            <h2>我的任务</h2>
            <p className="muted">“视频 + 信息图 + 封面”成功后，请点“产物”查看封面/信息图/概念图；列表默认只突出视频入口</p>
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
                        ? `${c.latestReview.action}${c.latestReview.comment ? `，${c.latestReview.comment}` : ''}`
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
                </p>
                <AdminReview onDone={refresh} />
              </>
            ) : (
              <>
                <p className="muted">仅展示本学科学生待审作品；教师/管理员作品由管理员审核，跨学科不可见</p>
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
              <p className="muted">这里改的是全站默认；各角色可在“个人中心 → 模型设置”覆盖。</p>
                <AdminConfig />
              </div>
            </div>
            <div className="card">
              <h3>用户管理</h3>
              <AdminUsers subjects={subjectOptions} />
            </div>
            <div className="card">
              <h3>学科与知识点</h3>
              <p className="muted">学科/知识点维护已移到左侧菜单“学科与知识点”，避免管理后台页面过长。</p>
              <button className="btn" onClick={() => setView('admin-knowledge')}>打开学科与知识点管理</button>
            </div>
          </div>
        )}

        {view === 'admin-knowledge' && user?.role === 'admin' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>学科与知识点管理</h2>
                <p className="muted" style={{ margin: 0 }}>维护大类学科与子类知识点；生成页可下拉选择或关键词搜索填入章节/主题。</p>
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

const EMPTY_PILOT_FORM = {
  schoolName: '', region: '', teacherName: '', className: '', gradeCode: '', subjectCode: '', textbookEdition: '', topic: '', courseId: '', jobId: '',
  studentCount: '', prepBeforeMinutes: '', prepAfterMinutes: '', preQuizTotal: '', preQuizCorrect: '', postQuizTotal: '', postQuizCorrect: '',
  teacherAccuracyScore: '', teacherUsefulnessScore: '', teacherFeedback: '', networkMode: 'online', offlineDownloaded: false, offlinePlayed: false,
  playbackDurationSec: '', playbackInterruptionCount: '0', incidentNote: '', consentConfirmed: false
};

function RuralPilotView({ user, courses, subjects, grades, onLogin }: {
  user: User | null;
  courses: CourseItem[];
  subjects: { code: string; name: string }[];
  grades: { code: string; name: string }[];
  onLogin: () => void;
}) {
  const [records, setRecords] = useState<RuralPilotRecord[]>([]);
  const [summary, setSummary] = useState<RuralPilotSummary | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_PILOT_FORM });
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');
  const canUse = user?.role === 'teacher' || user?.role === 'admin';

  async function load() {
    if (!canUse) return;
    try {
      const [recordList, summaryData] = await Promise.all([ruralPilotService.list(), ruralPilotService.summary()]);
      setRecords(recordList);
      setSummary(summaryData);
    } catch (error: any) {
      setStatus(error.message || '加载试点记录失败');
    }
  }

  useEffect(() => { load(); }, [user?.id]);

  function setField(name: string, value: any) {
    setForm((current: any) => ({ ...current, [name]: value }));
  }

  function selectCourse(courseId: string) {
    const course = courses.find((item) => item.id === courseId);
    setForm((current: any) => ({
      ...current,
      courseId,
      topic: course?.topic || current.topic,
      subjectCode: course?.subject || current.subjectCode,
      gradeCode: course?.grade || current.gradeCode
    }));
  }

  function numberOrNull(value: string) {
    return value === '' ? null : Number(value);
  }

  function payload() {
    return {
      ...form,
      studentCount: numberOrNull(form.studentCount),
      prepBeforeMinutes: numberOrNull(form.prepBeforeMinutes),
      prepAfterMinutes: numberOrNull(form.prepAfterMinutes),
      preQuizTotal: numberOrNull(form.preQuizTotal),
      preQuizCorrect: numberOrNull(form.preQuizCorrect),
      postQuizTotal: numberOrNull(form.postQuizTotal),
      postQuizCorrect: numberOrNull(form.postQuizCorrect),
      teacherAccuracyScore: numberOrNull(form.teacherAccuracyScore),
      teacherUsefulnessScore: numberOrNull(form.teacherUsefulnessScore),
      playbackDurationSec: numberOrNull(form.playbackDurationSec),
      playbackInterruptionCount: numberOrNull(form.playbackInterruptionCount) ?? 0
    };
  }

  async function saveDraft() {
    try {
      const saved = editingId ? await ruralPilotService.update(editingId, payload()) : await ruralPilotService.create(payload());
      setEditingId(saved.id);
      setStatus('试点记录草稿已保存');
      await load();
    } catch (error: any) {
      setStatus(error.message || '保存失败');
    }
  }

  function editRecord(record: RuralPilotRecord) {
    setEditingId(record.id);
    setForm({
      ...EMPTY_PILOT_FORM,
      ...record,
      studentCount: record.studentCount ?? '', prepBeforeMinutes: record.prepBeforeMinutes ?? '', prepAfterMinutes: record.prepAfterMinutes ?? '',
      preQuizTotal: record.preQuizTotal ?? '', preQuizCorrect: record.preQuizCorrect ?? '', postQuizTotal: record.postQuizTotal ?? '', postQuizCorrect: record.postQuizCorrect ?? '',
      teacherAccuracyScore: record.teacherAccuracyScore ?? '', teacherUsefulnessScore: record.teacherUsefulnessScore ?? '', playbackDurationSec: record.playbackDurationSec ?? '',
      playbackInterruptionCount: record.playbackInterruptionCount ?? 0
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitRecord(id: string) {
    try {
      await ruralPilotService.submit(id);
      setStatus('记录已提交，管理员可进行真实性复核');
      await load();
    } catch (error: any) {
      setStatus(error.message || '提交失败');
    }
  }

  async function verifyRecord(id: string) {
    try {
      await ruralPilotService.verify(id);
      setStatus('记录已标记为已复核');
      await load();
    } catch (error: any) {
      setStatus(error.message || '复核失败');
    }
  }

  const percent = (value: number | null | undefined) => value == null ? '暂无数据' : `${(value * 100).toFixed(1)}%`;
  const metric = (value: number | null | undefined, suffix = '') => value == null ? '暂无数据' : `${value.toFixed(1)}${suffix}`;

  if (!user) return <div className="card"><h2>真实试点记录</h2><p className="muted">登录教师账号后，可记录备课效率、学生前后测、教师评价与离线播放现场。</p><button className="btn" onClick={onLogin}>登录后填写</button></div>;
  if (!canUse) return <div className="card"><h2>真实试点记录</h2><p className="muted">该功能面向教师与管理员，用于采集比赛所需的真实课堂证据。</p></div>;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>真实乡村课堂试点证据</h2>
        <p className="muted">这里只保存真实授权数据，不预置演示结论，不记录学生姓名、身份证、联系方式等个人敏感信息</p>
        {summary?.hasData ? (
          <div className="grid cols-3" style={{ marginTop: 12 }}>
            <div className="stat"><div className="stat-label">已提交试点</div><strong>{summary.submittedRecordCount}</strong></div>
            <div className="stat"><div className="stat-label">平均节省备课</div><strong>{metric(summary.prep.savedAvgMinutes, ' 分钟')}</strong></div>
            <div className="stat"><div className="stat-label">小题正确率提升</div><strong>{percent(summary.quiz.improvement)}</strong></div>
            <div className="stat"><div className="stat-label">AI 回答准确率</div><strong>{metric(summary.teacher.accuracyAvg, ' / 5')}</strong></div>
            <div className="stat"><div className="stat-label">AI 可用性</div><strong>{metric(summary.teacher.usefulnessAvg, ' / 5')}</strong></div>
            <div className="stat"><div className="stat-label">离线播放记录</div><strong>{summary.network.offlinePlayedCount}</strong></div>
          </div>
        ) : <div className="assistant-notice" style={{ marginTop: 12 }}><ClipboardCheck size={17} /><span>暂无真实试点数据。完成课堂试点并提交记录后，系统才会计算效果指标。</span></div>}
      </div>

      <div className="card">
        <h3>{editingId ? '编辑试点记录' : '新建试点记录'}</h3>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <label>关联课程<select value={form.courseId} onChange={(event) => selectCourse(event.target.value)}><option value="">不关联课</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <label>学校名称 *<input value={form.schoolName} onChange={(event) => setField('schoolName', event.target.value)} placeholder="真实学校名称；公开展示时建议脱敏" /></label>
          <label>地区 *<input value={form.region} onChange={(event) => setField('region', event.target.value)} placeholder="省 / 市 / 县 / 乡镇" /></label>
          <label>教师姓名 *<input value={form.teacherName} onChange={(event) => setField('teacherName', event.target.value)} /></label>
          <label>班级<input value={form.className} onChange={(event) => setField('className', event.target.value)} /></label>
          <label>知识点 / 课题 *<input value={form.topic} onChange={(event) => setField('topic', event.target.value)} /></label>
          <label>学科<select value={form.subjectCode} onChange={(event) => setField('subjectCode', event.target.value)}><option value="">请选择</option>{subjects.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label>年级<select value={form.gradeCode} onChange={(event) => setField('gradeCode', event.target.value)}><option value="">请选择</option>{grades.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label>教材版本<input value={form.textbookEdition} onChange={(event) => setField('textbookEdition', event.target.value)} placeholder="如：人教版" /></label>
          <label>学生人数<input type="number" min="0" value={form.studentCount} onChange={(event) => setField('studentCount', event.target.value)} /></label>
        </div>

        <h4 style={{ marginTop: 20 }}>备课效率</h4>
        <div className="grid cols-2"><label>使用前备课耗时（分钟）<input type="number" min="0" value={form.prepBeforeMinutes} onChange={(event) => setField('prepBeforeMinutes', event.target.value)} /></label><label>使用后备课耗时（分钟）<input type="number" min="0" value={form.prepAfterMinutes} onChange={(event) => setField('prepAfterMinutes', event.target.value)} /></label></div>

        <h4 style={{ marginTop: 20 }}>学生课前 / 课后小题</h4>
        <div className="grid cols-2"><label>课前题目<input type="number" min="0" value={form.preQuizTotal} onChange={(event) => setField('preQuizTotal', event.target.value)} /></label><label>课前答对<input type="number" min="0" value={form.preQuizCorrect} onChange={(event) => setField('preQuizCorrect', event.target.value)} /></label><label>课后题目<input type="number" min="0" value={form.postQuizTotal} onChange={(event) => setField('postQuizTotal', event.target.value)} /></label><label>课后答对<input type="number" min="0" value={form.postQuizCorrect} onChange={(event) => setField('postQuizCorrect', event.target.value)} /></label></div>

        <h4 style={{ marginTop: 20 }}>教师评价</h4>
        <div className="grid cols-2"><label>AI 回答准确率（1-5）<input type="number" min="1" max="5" step="0.5" value={form.teacherAccuracyScore} onChange={(event) => setField('teacherAccuracyScore', event.target.value)} /></label><label>AI 可用性（1-5）<input type="number" min="1" max="5" step="0.5" value={form.teacherUsefulnessScore} onChange={(event) => setField('teacherUsefulnessScore', event.target.value)} /></label></div>
        <label>教师反馈<textarea value={form.teacherFeedback} onChange={(event) => setField('teacherFeedback', event.target.value)} placeholder="记录准确性、可直接使用部分和需要教师修正部分" /></label>

        <h4 style={{ marginTop: 20 }}>低带宽 / 离线播放现场</h4>
        <div className="grid cols-2">
          <label>网络状态<select value={form.networkMode} onChange={(event) => setField('networkMode', event.target.value)}><option value="online">在线稳定</option><option value="unstable">网络不稳定</option><option value="offline">离线环境</option></select></label>
          <label>播放时长（秒）<input type="number" min="0" value={form.playbackDurationSec} onChange={(event) => setField('playbackDurationSec', event.target.value)} /></label>
          <label>播放中断次数<input type="number" min="0" value={form.playbackInterruptionCount} onChange={(event) => setField('playbackInterruptionCount', event.target.value)} /></label>
          <div className="row"><label className="row"><input type="checkbox" checked={form.offlineDownloaded} onChange={(event) => setField('offlineDownloaded', event.target.checked)} />已下载离线视频</label><label className="row"><input type="checkbox" checked={form.offlinePlayed} onChange={(event) => setField('offlinePlayed', event.target.checked)} />已实际离线播放</label></div>
        </div>
        <label>现场异常与记录<textarea value={form.incidentNote} onChange={(event) => setField('incidentNote', event.target.value)} placeholder="如：网络中断、设备型号、投影环境、播放是否卡顿" /></label>
        <label className="row" style={{ marginTop: 12 }}><input type="checkbox" checked={form.consentConfirmed} onChange={(event) => setField('consentConfirmed', event.target.checked)} />已获得学校或教师授权，并确认未填写学生个人敏感信息</label>
        <div className="row" style={{ marginTop: 16 }}><button className="btn" onClick={saveDraft}>保存草稿</button><button className="btn secondary" onClick={() => { setEditingId(''); setForm({ ...EMPTY_PILOT_FORM }); }}>新建空白记录</button><span className="muted">{status}</span></div>
      </div>

      <div className="card">
        <h3>试点记录清单</h3>
        {!records.length ? <p className="muted">尚未填写真实试点记录</p> : <table><thead><tr><th>学校 / 地区</th><th>课题</th><th>备课耗时</th><th>正确</th><th>网络</th><th>状态</th><th>操作</th></tr></thead><tbody>{records.map((record) => {
          const preRate = record.preQuizTotal ? record.preQuizCorrect! / record.preQuizTotal : null;
          const postRate = record.postQuizTotal ? record.postQuizCorrect! / record.postQuizTotal : null;
          return <tr key={record.id}><td>{record.schoolName}<div className="muted">{record.region}</div></td><td>{record.topic}</td><td>{record.prepBeforeMinutes ?? '-'} → {record.prepAfterMinutes ?? '-'} 分钟</td><td>{preRate == null ? '-' : percent(preRate)} → {postRate == null ? '-' : percent(postRate)}</td><td>{record.networkMode}{record.offlinePlayed ? ' / 已离线播放' : ''}</td><td>{record.status === 'draft' ? '草稿' : record.status === 'submitted' ? '已提交' : '已复核'}</td><td><div className="row"><button className="btn secondary" onClick={() => editRecord(record)}>查看 / 编辑</button>{record.status === 'draft' && <button className="btn" onClick={() => submitRecord(record.id)}>提交</button>}{user.role === 'admin' && record.status === 'submitted' && <button className="btn" onClick={() => verifyRecord(record.id)}>复核</button>}</div></td></tr>;
        })}</tbody></table>}
      </div>
    </div>
  );
}
type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: AssistantResponse;
};

function AssistantView({
  user,
  subjects,
  grades,
  onLogin
}: {
  user: User | null;
  subjects: { code: string; name: string }[];
  grades: { code: string; name: string }[];
  onLogin: () => void;
}) {
  const [context, setContext] = useState({ subject: 'physics', grade: 'grade8', chapter: '机械能与能量', textbookEdition: '人教版' });
  const [question, setQuestion] = useState('为什么机械能减少了，能量还可以守恒？');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: 'welcome', role: 'assistant', content: '告诉我学科、年级和问题。我会优先使用项目知识库，模型不可用时自动切换到本地回答。' }
  ]);

  async function ask(override?: string) {
    if (!user) {
      onLogin();
      return;
    }
    const currentQuestion = String(override || question).trim();
    if (!currentQuestion || loading) return;
    const userMessage: AssistantMessage = { id: String(Date.now()), role: 'user', content: currentQuestion };
    const history = messages.filter((item) => item.id !== 'welcome').map((item) => ({ role: item.role, content: item.content }));
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setLoading(true);
    try {
      const result = await assistantService.ask({ ...context, question: currentQuestion, history });
      setMessages((current) => [...current, {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: result.answer,
        result
      }]);
    } catch (error: any) {
      setMessages((current) => [...current, {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: error?.message || '助教暂时无法回答，请稍后重试。'
      }]);
    } finally {
      setLoading(false);
    }
  }

  const lastResult = [...messages].reverse().find((item) => item.result)?.result;

  return (
    <div className="assistant-layout">
      <div className="card assistant-context">
        <div className="eyebrow"><Bot size={16} aria-hidden="true" />课堂上下文</div>
        <h2>AI 课堂助教</h2>
        <p className="muted">先限定教材范围，再提问回答用于辅助教师，不替代教师判断</p>
        <div className="grid" style={{ gap: 12 }}>
          <label>学科
            <select value={context.subject} onChange={e => setContext({ ...context, subject: e.target.value })}>
              {subjects.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label>年级
            <select value={context.grade} onChange={e => setContext({ ...context, grade: e.target.value })}>
              {grades.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label>章节<input value={context.chapter} onChange={e => setContext({ ...context, chapter: e.target.value })} /></label>
          <label>教材版本
            <select value={context.textbookEdition} onChange={e => setContext({ ...context, textbookEdition: e.target.value })}>
              <option value="人教版">人教版</option><option value="部编版">部编版</option><option value="北师大版">北师大版</option><option value="苏教版">苏教版</option><option value="校本教材">校本教材</option>
            </select>
          </label>
        </div>
        <div className="assistant-notice"><WifiOff size={17} aria-hidden="true" /><span>优先使用已配置的大模型结合知识库回答；模型不可用时自动回退本地知识库库。</span></div>
      </div>
      <div className="card chat-panel">
        <div className="chat-header">
          <div><h2>课堂问答</h2><span className="muted">知识库检索 + 可选大模型解释</span></div>
          {lastResult && <span className="badge">{lastResult.mode === 'llm' ? '大模型增强' : '本地知识库'}</span>}
        </div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((item) => (
            <div className={'chat-message ' + item.role} key={item.id}>
              <div className="chat-role">{item.role === 'assistant' ? 'AI 助教' : user?.nickname || '鎴'}</div>
              <div className="chat-content">{item.content}</div>
              {item.result?.sources?.length ? (
                <div className="source-list">
                  <span>依据</span>
                  {item.result.sources.map((source) => <span className="badge" key={source.id}>{source.topic} · {source.chapter}</span>)}
                </div>
              ) : null}
            </div>
          ))}
          {loading && <div className="chat-message assistant"><div className="chat-role">AI 助教</div><div className="chat-content">正在检索知识点并组织课堂解释</div></div>}
        </div>
        {lastResult?.suggestedQuestions?.length ? (
          <div className="suggestion-row">
            {lastResult.suggestedQuestions.map((item) => <button className="btn ghost" key={item} onClick={() => ask(item)}>{item}</button>)}
          </div>
        ) : null}
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); ask(); }}>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="例如：为什么机械能减少了，能量还可以守恒？" />
          <button className="btn" type="submit" disabled={loading}><Send size={18} aria-hidden="true" />{user ? '提问' : '登录后提问'}</button>
        </form>
      </div>
    </div>
  );
}

function ClassroomView({ courses, onCreate }: { courses: CourseItem[]; onCreate: () => void }) {
  const playable = courses.filter((course) => Boolean(course.videoUrl));
  const [selectedId, setSelectedId] = useState(playable[0]?.id || '');
  const playerRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!playable.some((course) => course.id === selectedId)) setSelectedId(playable[0]?.id || '');
  }, [courses, selectedId]);
  const selected = playable.find((course) => course.id === selectedId) || playable[0];

  return (
    <div className="classroom-layout">
      <div className="card classroom-stage">
        <div className="chat-header">
          <div><div className="eyebrow"><MonitorPlay size={16} aria-hidden="true" />课堂大屏模式</div><h2>{selected?.title || '暂无可播放课'}</h2></div>
          {selected && <span className="badge">{selected.subject} · {selected.grade}</span>}
        </div>
        {selected?.videoUrl ? (
          <>
            <video ref={playerRef} src={selected.videoUrl} controls preload="metadata" className="classroom-video" />
            <div className="row classroom-actions">
              <button className="btn" onClick={() => playerRef.current?.requestFullscreen?.()}><Maximize2 size={18} aria-hidden="true" />全屏授课</button>
              <a className="btn secondary" href={selected.videoUrl} download><Download size={18} aria-hidden="true" />下载离线视频</a>
            </div>
            <div className="assistant-notice"><WifiOff size={17} aria-hidden="true" /><span>建议课前下载到本机；课堂中可暂停视频，使用 AI 助教补充解释和随堂提问</span></div>
          </>
        ) : (
          <div className="empty-state"><p>课程广场还没有通过审核的教学视频</p><button className="btn" onClick={onCreate}>先去一键备课</button></div>
        )}
      </div>
      <div className="card classroom-playlist">
        <h3>课堂播放列表</h3>
        <p className="muted">仅显示已公开且有视频的课程</p>
        {playable.map((course) => (
          <button className={'playlist-item ' + (course.id === selected?.id ? 'active' : '')} key={course.id} onClick={() => setSelectedId(course.id)}>
            <strong>{course.title}</strong>
            <span>{course.subject} · {course.grade} · {course.chapter}</span>
          </button>
        ))}
        {!playable.length && <div className="muted">暂无课程</div>}
      </div>
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
      setStatus('系统默认配置已更新');
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
        系统默认优先级：任务覆盖 &gt; 个人模型设置 &gt; 管理后台系统默认 &gt; `.env/.env.compose`。管理员、教师和学生都可在个人中心 → 模型设置中配置自己的 TTS / 文生图。
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
              <option value="qwenimage">Alibaba Qwen-Image</option>
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
              ['atlascloud', 'Atlas Cloud'],
              ['qwenimage', 'Alibaba Qwen-Image']
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
  if (t.startsWith('artifacts')) return '嵥';
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
          <div className="muted">角色：{user.role} · 䣺{user.email}</div>
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
          Edge TTS / say 免费无需 Key。收费 TTS 与文生图：教师、学生必须在此填写自己的 API Key（及可选 URL/模型名）后才能使用。管理员可不填，默认读取服务器 `.env` / `.env.compose`。
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
                    ? (cred.apiKeySet ? '已保存 API Key，留空则保持不变' : (field.placeholder || '请输入 API Key'))
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
          免费：Edge TTS、macOS say、HyperFrames 本地渲染。收费：Seed TTS / Minimax / 全部文生图模型。          教师与学生使用收费模型前，必须在个人中心配置对应 API Key、可?API URL 与模型名称；管理员默认可直接使用服务器环境变量?        </div>
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
          <label>语速            <input type="number" min={0.5} max={2} step={0.1} disabled={!settings.ttsEnabled} value={settings.ttsSpeed ?? 1} onChange={e => setSettings({ ...settings, ttsSpeed: Number(e.target.value) })} />
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
          placeholder="输入关键词匹配，如：守恒 / 等高线 / 1919"
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
      <label>知识?/ 课程主题
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
      focusEditor(`正在编辑：${pointForm.topic}`);
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
        <div className="muted">左侧浏览知识点，右侧直接编辑；点击“编辑”会把内容填入右侧并定位到表单。</div>
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
              placeholder="搜索知识点、章节/关键词"
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button className="btn secondary" onClick={applySearch}>搜索</button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  setStatus('正在?KNOWLEDGE_PACKS 同步');
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
            {!points.length && <div className="muted">暂无知识点，可点击右上角“新增知识点”或“一键同步动画知识包”。</div>}
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
            <label>关联动画包              <select value={pointForm.animationPack || 'generic'} onChange={(e) => setPointForm({ ...pointForm, animationPack: e.target.value })}>
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
