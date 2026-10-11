(function (global) {
  const h = React.createElement;

  /**
   * Presentational Component: StudentList
   * Receives `students` array from the single state owner (StudentListApp) via props.
   * Renders the search filter and maps each student to a <StudentRow />.
   */
  function StudentList({ students, lastAddedId, searchQuery, onSearchChange }) {
    const query = (searchQuery || '').trim().toLowerCase();
    const filteredStudents = query
      ? students.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query) ||
            String(s.id).includes(query)
        )
      : students;

    return h(
      'section',
      { id: 'directory', className: 'space-y-4' },
      // Header & Quick Search
      h(
        'div',
        { className: 'flex flex-col sm:flex-row sm:items-center justify-between gap-4' },
        h(
          'div',
          null,
          h(
            'div',
            { className: 'flex items-center gap-2.5' },
            h('h2', { className: 'text-lg font-bold text-white tracking-tight' }, 'Active Student Records'),
            h(
              'span',
              {
                className:
                  'px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-zinc-900 text-zinc-300 border border-zinc-800',
              },
              `${students.length} TOTAL`
            )
          ),
          h(
            'p',
            { className: 'text-xs text-zinc-400 font-mono' },
            'Rendered from React State (Single Source of Truth) // Zero Page Reload'
          )
        ),
        students.length > 0
          ? h(
              'div',
              { className: 'relative w-full sm:w-72' },
              h('input', {
                type: 'text',
                id: 'quick-filter',
                value: searchQuery,
                onChange: (e) => onSearchChange(e.target.value),
                placeholder: 'Search by name or email...',
                className:
                  'w-full pl-9 pr-12 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-100 placeholder-zinc-500 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors',
              }),
              h(
                'svg',
                {
                  className: 'w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2',
                  viewBox: '0 0 24 24',
                },
                h('path', {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
                })
              ),
              h(
                'kbd',
                {
                  className:
                    'hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700 pointer-events-none',
                },
                'CSR'
              )
            )
          : null
      ),
      // Table Container
      h(
        'div',
        {
          className:
            'rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md overflow-hidden shadow-xl',
        },
        filteredStudents.length === 0
          ? h(
              'div',
              { className: 'p-12 text-center space-y-3 font-mono' },
              h(
                'p',
                { className: 'text-sm font-bold text-zinc-300' },
                'No matching student records found'
              ),
              h(
                'p',
                { className: 'text-xs text-zinc-500 max-w-sm mx-auto' },
                'Try clearing the search filter or add a new student using the controlled form above.'
              )
            )
          : h(
              'div',
              { className: 'overflow-x-auto' },
              h(
                'table',
                { className: 'w-full text-left border-collapse font-mono', id: 'students-table' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    {
                      className:
                        'border-b border-zinc-800/80 bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-400',
                    },
                    h('th', { className: 'py-3 px-5' }, 'System ID'),
                    h('th', { className: 'py-3 px-5' }, 'Full Name'),
                    h('th', { className: 'py-3 px-5' }, 'Email Address')
                  )
                ),
                h(
                  'tbody',
                  { className: 'divide-y divide-zinc-900 text-xs' },
                  filteredStudents.map((student) =>
                    h(global.StudentRow, {
                      key: student.id,
                      student,
                      isHighlight: student.id === lastAddedId,
                    })
                  )
                )
              )
            )
      )
    );
  }

  global.StudentList = StudentList;
})(window);
