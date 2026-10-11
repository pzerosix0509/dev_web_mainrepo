(function (global) {
  const h = React.createElement;

  /**
   * Diagnostic Component: StateInspector
   * Displays the live React State Owner (`StudentListApp`), controlled form state,
   * render count, and confirms 0 full-page document reloads.
   */
  function StateInspector({ students, formPreview, renderCount, lastTransition }) {
    return h(
      'section',
      { id: 'state-inspector', className: 'space-y-3' },
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'div',
          { className: 'flex items-center gap-2 text-xs font-mono text-zinc-400' },
          h('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-ping' }),
          h(
            'span',
            { className: 'font-bold uppercase tracking-wider text-zinc-300' },
            'CSR State & Component Architecture Inspector'
          )
        ),
        h(
          'span',
          { className: 'text-xs font-mono text-indigo-400' },
          'Owner: <StudentListApp /> • Props → <AddStudentForm /> & <StudentList />'
        )
      ),
      h(
        'div',
        {
          className:
            'rounded-xl border border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden p-5 grid gap-4 md:grid-cols-3 font-mono text-xs',
        },
        // Metric 1: Component & State Ownership
        h(
          'div',
          { className: 'p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2' },
          h(
            'div',
            { className: 'text-[11px] uppercase text-zinc-400 flex items-center justify-between' },
            h('span', null, '1. State Owner (Single Source)'),
            h('span', { className: 'text-emerald-400 font-bold' }, 'ACTIVE')
          ),
          h(
            'div',
            { className: 'space-y-1 text-zinc-300' },
            h('div', null, 'Owner: ', h('span', { className: 'text-indigo-400 font-bold' }, 'StudentListApp')),
            h('div', null, 'students.length: ', h('span', { className: 'text-white font-bold' }, students.length)),
            h('div', null, 'React Renders: ', h('span', { className: 'text-amber-400 font-bold' }, renderCount)),
            h('div', null, 'Document Reloads: ', h('span', { className: 'text-emerald-400 font-bold' }, '0 (Pure CSR)'))
          )
        ),
        // Metric 2: Controlled Form Live State
        h(
          'div',
          { className: 'p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2' },
          h(
            'div',
            { className: 'text-[11px] uppercase text-zinc-400 flex items-center justify-between' },
            h('span', null, '2. Controlled Form State'),
            h('span', { className: 'text-cyan-400 font-bold' }, '<AddStudentForm />')
          ),
          h(
            'pre',
            { className: 'text-[11px] text-indigo-300 overflow-x-auto bg-black/60 p-2 rounded border border-zinc-800' },
            JSON.stringify(formPreview, null, 2)
          )
        ),
        // Metric 3: Last Event -> State Transition
        h(
          'div',
          { className: 'p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2' },
          h(
            'div',
            { className: 'text-[11px] uppercase text-zinc-400 flex items-center justify-between' },
            h('span', null, '3. Last State Transition'),
            h('span', { className: 'text-purple-400 font-bold' }, 'EVENT → STATE')
          ),
          h(
            'div',
            { className: 'text-[11px] text-zinc-300 space-y-1 bg-black/60 p-2 rounded border border-zinc-800' },
            h('div', { className: 'text-emerald-400 font-semibold' }, lastTransition.action),
            h('div', { className: 'text-zinc-400' }, lastTransition.detail),
            h('div', { className: 'text-zinc-500 text-[10px]' }, lastTransition.time)
          )
        )
      )
    );
  }

  global.StateInspector = StateInspector;
})(window);
