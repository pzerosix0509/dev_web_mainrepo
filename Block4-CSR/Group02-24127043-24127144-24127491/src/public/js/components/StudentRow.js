(function (global) {
  const h = React.createElement;

  /**
   * Presentational Component: StudentRow
   * Receives a single `student` object via props and renders one table row.
   */
  function StudentRow({ student, isHighlight }) {
    return h(
      'tr',
      {
        className: `student-row hover:bg-zinc-900/60 transition-colors group ${
          isHighlight ? 'animate-fade-in bg-indigo-950/25' : ''
        }`,
      },
      // System ID
      h(
        'td',
        { className: 'py-3 px-5' },
        h(
          'span',
          {
            className:
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 group-hover:bg-zinc-800 text-zinc-400 text-[11px] border border-zinc-800 transition-colors',
          },
          h('span', { className: 'text-zinc-600' }, '#'),
          student.id
        )
      ),
      // Full Name & Avatar Badge
      h(
        'td',
        { className: 'py-3 px-5' },
        h(
          'div',
          { className: 'flex items-center gap-3' },
          h(
            'div',
            {
              className: `w-7 h-7 rounded-md ${
                student.avatarColor || 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/40'
              } flex items-center justify-center font-bold text-[10px] flex-shrink-0 shadow-sm`,
            },
            student.initials || 'ST'
          ),
          h('span', { className: 'font-semibold text-zinc-100 student-name' }, student.name),
          isHighlight
            ? h(
                'span',
                {
                  className:
                    'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50',
                },
                'NEW (CSR)'
              )
            : null
        )
      ),
      // Email Address
      h(
        'td',
        { className: 'py-3 px-5' },
        h(
          'a',
          {
            href: `mailto:${student.email}`,
            className:
              'text-zinc-400 hover:text-indigo-400 transition-colors student-email flex items-center gap-1.5',
          },
          h(
            'svg',
            {
              className: 'w-3.5 h-3.5 text-zinc-600 group-hover:text-indigo-400 transition-colors',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2',
              viewBox: '0 0 24 24',
            },
            h('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
            })
          ),
          student.email
        )
      )
    );
  }

  global.StudentRow = StudentRow;
})(window);
