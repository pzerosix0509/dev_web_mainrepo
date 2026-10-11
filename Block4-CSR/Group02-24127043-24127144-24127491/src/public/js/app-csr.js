(function (global) {
  const { useState, useEffect, useRef } = React;
  const h = React.createElement;
  const { SEED_STUDENTS, enrichStudent } = global.TDP_SEED;

  /**
   * Presentational Layout Component: StudentPage
   * Receives `students` and `onAdd` from the State Owner (`StudentListApp`) via props.
   */
  function StudentPage({
    students,
    onAdd,
    lastAddedId,
    searchQuery,
    onSearchChange,
    formPreview,
    onFormStateChange,
    renderCount,
    lastTransition,
  }) {
    return h(
      'div',
      { className: 'min-h-screen flex flex-col' },
      // Top Navigation Bar
      h(
        'header',
        { className: 'border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-40' },
        h(
          'div',
          { className: 'max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between' },
          h(
            'div',
            { className: 'flex items-center gap-8' },
            h(
              'a',
              { href: '#root', className: 'flex items-center gap-2 group' },
              h(
                'span',
                {
                  className:
                    'font-mono text-xl sm:text-2xl font-black tracking-tighter text-white uppercase group-hover:text-indigo-400 transition-colors',
                },
                'T',
                h('span', { className: 'text-indigo-500' }, 'DP')
              ),
              h(
                'span',
                {
                  className:
                    'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60',
                },
                'CSR_REACT_v4'
              )
            ),
            h(
              'nav',
              { className: 'hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400' },
              h('a', { href: '#state-inspector', className: 'hover:text-white transition-colors' }, 'State Inspector'),
              h('a', { href: '#student-form-section', className: 'hover:text-white transition-colors' }, 'Add Student'),
              h('a', { href: '#directory', className: 'hover:text-white transition-colors' }, 'Directory')
            )
          ),
          h(
            'div',
            { className: 'flex items-center gap-3' },
            h(
              'span',
              { className: 'hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono' },
              h('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }),
              'React 18 CSR Engine'
            ),
            h(
              'a',
              {
                href: '#student-form-section',
                className:
                  'bg-white text-black font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-zinc-200 active:scale-95 transition-all shadow-sm',
              },
              '+ Add Entry'
            )
          )
        )
      ),
      // Main Content
      h(
        'main',
        { className: 'flex-1 blueprint-grid relative' },
        h(
          'div',
          { className: 'max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12 relative z-10' },
          // Hero Section
          h(
            'section',
            { className: 'max-w-3xl space-y-4' },
            h(
              'h1',
              { className: 'text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] text-white' },
              'Meet the student directory ',
              h('br'),
              'built for ',
              h(
                'span',
                { className: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500' },
                'pure CSR'
              ),
              '.'
            ),
            h(
              'div',
              { className: 'space-y-1 text-xs text-zinc-400 pt-1 font-mono' },
              h(
                'p',
                null,
                'HTML Shell ',
                h('strong', { className: 'text-white' }, '<div id="root"></div>'),
                ' ➔ React Component State ➔ ',
                h('strong', { className: 'text-emerald-400' }, 'Zero Document Reload'),
                '.'
              ),
              h(
                'p',
                { className: 'text-zinc-500' },
                'Single State Owner: ',
                h('span', { className: 'text-indigo-400' }, 'StudentListApp'),
                ' • Controlled Form: ',
                h('span', { className: 'text-indigo-400' }, 'AddStudentForm'),
                ' • List & Row: ',
                h('span', { className: 'text-indigo-400' }, 'StudentList / StudentRow')
              )
            )
          ),
          // Live State Inspector
          h(global.StateInspector, {
            students,
            formPreview,
            renderCount,
            lastTransition,
          }),
          // Controlled Add Student Form
          h(global.AddStudentForm, {
            onAdd,
            onFormStateChange,
          }),
          // Student Directory Table
          h(global.StudentList, {
            students,
            lastAddedId,
            searchQuery,
            onSearchChange,
          })
        )
      ),
      // Footer
      h(
        'footer',
        { className: 'border-t border-zinc-900 bg-black text-xs font-mono text-zinc-500 py-8' },
        h(
          'div',
          { className: 'max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4' },
          h(
            'div',
            { className: 'flex items-center gap-3' },
            h('span', { className: 'font-black text-zinc-300' }, 'TDP // Group 02'),
            h('span', null, '•'),
            h('span', null, 'Block #4 — Client-Side Rendered (CSR) Student Management')
          ),
          h('div', null, h('span', null, '100% Client-Side Rendered UI (React 18 State)'))
        )
      )
    );
  }

  /**
   * SINGLE STATE OWNER: StudentListApp (matches Slide 8 & Slide 14)
   * - Holds the single source of truth `students` state initialized with `SEED_STUDENTS`.
   * - Synchronizes with `GET /api/students` on mount if the backend API is running.
   * - Updates state immutably (`setStudents(current => [...current, newStudent])`) on submit.
   */
  function StudentListApp() {
    const [students, setStudents] = useState(SEED_STUDENTS);
    const [lastAddedId, setLastAddedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formPreview, setFormPreview] = useState({ name: '', email: '' });
    const [lastTransition, setLastTransition] = useState({
      action: 'INIT_STATE (Seed Data)',
      detail: `Initialized students state with ${SEED_STUDENTS.length} seed records`,
      time: new Date().toLocaleTimeString(),
    });

    const renderCountRef = useRef(0);
    renderCountRef.current += 1;

    // Sync initial state from JSON API (GET /api/students) if server is running
    useEffect(() => {
      let active = true;
      fetch('/api/students', { headers: { Accept: 'application/json' } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active && Array.isArray(data) && data.length > 0) {
            setStudents(data.map(enrichStudent));
            setLastTransition({
              action: 'HYDRATE_FROM_JSON_API',
              detail: `Loaded ${data.length} records from GET /api/students (no HTML rendered on server)`,
              time: new Date().toLocaleTimeString(),
            });
            console.log('[CSR State] Loaded students from GET /api/students:', data);
          }
        })
        .catch(() => {
          console.log('[CSR State] Using in-memory SEED_STUDENTS baseline.');
        });
      return () => {
        active = false;
      };
    }, []);

    // Event callback passed to <AddStudentForm onAdd={addStudent} />
    async function addStudent(cleanInput) {
      try {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(cleanInput),
        });

        const payload = await res.json();
        if (!res.ok) {
          return { ok: false, error: payload.error || (payload.errors && payload.errors[0]) };
        }

        // IMMUTABLE STATE UPDATE (Slide 8: setStudents(current => [...current, student]))
        setStudents((current) => {
          const enriched = enrichStudent(payload, current.length);
          const nextState = [...current, enriched];
          console.log('[CSR State Transition] prev count:', current.length, '-> next count:', nextState.length, enriched);
          return nextState;
        });
        setLastAddedId(String(payload.id));
        setLastTransition({
          action: 'ADD_STUDENT (setStudents([...current, student]))',
          detail: `Added "${payload.name}" (#${payload.id}) without reloading document`,
          time: new Date().toLocaleTimeString(),
        });
        return { ok: true };
      } catch (_networkErr) {
        // Fallback if opened as static file without backend API
        const fallbackStudent = {
          id: String(Date.now()),
          name: cleanInput.name,
          email: cleanInput.email,
        };
        setStudents((current) => {
          const enriched = enrichStudent(fallbackStudent, current.length);
          const nextState = [...current, enriched];
          console.log('[CSR State Transition (Client-only)]', nextState);
          return nextState;
        });
        setLastAddedId(fallbackStudent.id);
        setLastTransition({
          action: 'ADD_STUDENT_CLIENT_STATE',
          detail: `Added "${fallbackStudent.name}" (#${fallbackStudent.id}) in client state`,
          time: new Date().toLocaleTimeString(),
        });
        return { ok: true };
      }
    }

    return h(StudentPage, {
      students,
      onAdd: addStudent,
      lastAddedId,
      searchQuery,
      onSearchChange: setSearchQuery,
      formPreview,
      onFormStateChange: setFormPreview,
      renderCount: renderCountRef.current,
      lastTransition,
    });
  }

  const rootElement = document.getElementById('root');
  const root = ReactDOM.createRoot(rootElement);
  root.render(h(StudentListApp));
})(window);
