(function (global) {
  const { useState } = React;
  const h = React.createElement;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Controlled Form Component: AddStudentForm
   * - Owns local form input state (`form.name`, `form.email`) and validation errors (`fieldErrors`, `serverError`).
   * - Uses controlled inputs (`value` + `onChange`).
   * - Calls `e.preventDefault()` on submit so the browser NEVER reloads the document.
   * - Validates inputs, posts JSON via fetch (or falls back to client-side creation),
   *   pushes the new student up to the State Owner via `onAdd(student)`, and resets the form.
   */
  function AddStudentForm({ onAdd, onFormStateChange }) {
    const [form, setForm] = useState({ name: '', email: '' });
    const [fieldErrors, setFieldErrors] = useState({ name: '', email: '' });
    const [serverError, setServerError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function validateFields(values) {
      const trimmedName = (values.name || '').trim();
      const trimmedEmail = (values.email || '').trim();
      const nextErrors = { name: '', email: '' };

      if (!trimmedName) {
        nextErrors.name = 'Full name is required.';
      }
      if (!trimmedEmail) {
        nextErrors.email = 'Email address is required.';
      } else if (!EMAIL_RE.test(trimmedEmail)) {
        nextErrors.email = 'Please enter a valid email address.';
      }

      return {
        isValid: !nextErrors.name && !nextErrors.email,
        nextErrors,
        clean: { name: trimmedName, email: trimmedEmail },
      };
    }

    function handleInputChange(field, value) {
      const updated = { ...form, [field]: value };
      setForm(updated);
      if (onFormStateChange) onFormStateChange(updated);

      if (fieldErrors[field] || serverError) {
        const { nextErrors } = validateFields(updated);
        setFieldErrors((prev) => ({ ...prev, [field]: nextErrors[field] }));
        setServerError('');
      }
    }

    async function handleSubmit(e) {
      // 1. Prevent default HTML form submission (stops browser from sending a document navigation request)
      e.preventDefault();
      setServerError('');

      // 2. Client-side validation for instant feedback
      const { isValid, nextErrors, clean } = validateFields(form);
      setFieldErrors(nextErrors);
      if (!isValid) {
        return;
      }

      setSubmitting(true);
      try {
        // 3. Call JSON API (POST /api/students) without reloading page
        const result = await onAdd(clean);
        if (result && result.ok === false) {
          setServerError(result.error || 'Failed to add student.');
          setSubmitting(false);
          return;
        }

        // 4. Reset controlled form inputs after successful state update
        const resetForm = { name: '', email: '' };
        setForm(resetForm);
        setFieldErrors({ name: '', email: '' });
        if (onFormStateChange) onFormStateChange(resetForm);
      } catch (err) {
        setServerError(err.message || 'Unexpected error while adding student.');
      } finally {
        setSubmitting(false);
      }
    }

    return h(
      'section',
      { id: 'student-form-section', className: 'space-y-4' },
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'div',
          null,
          h(
            'h2',
            { className: 'text-lg font-bold text-white tracking-tight flex items-center gap-2' },
            h('span', null, 'Register New Student (Controlled Form)'),
            h(
              'span',
              {
                className:
                  'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/50',
              },
              'CSR State + JSON'
            )
          ),
          h(
            'p',
            { className: 'text-xs text-zinc-400 font-mono' },
            'Controlled inputs (value + onChange) • e.preventDefault() • Immutable setStudents()'
          )
        )
      ),
      serverError
        ? h(
            'div',
            {
              className:
                'rounded-lg bg-rose-950/40 border border-rose-500/80 text-rose-300 px-4 py-3 text-xs font-mono flex items-center gap-3 animate-shake',
            },
            h('span', null, serverError)
          )
        : null,
      h(
        'div',
        {
          className:
            'rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md p-5 sm:p-6 shadow-xl',
        },
        h(
          'form',
          {
            id: 'student-form',
            noValidate: true,
            onSubmit: handleSubmit,
            className: 'grid gap-4 sm:grid-cols-12 sm:items-start',
          },
          // Controlled Full Name Input
          h(
            'div',
            { className: 'sm:col-span-5 space-y-1.5' },
            h(
              'label',
              {
                htmlFor: 'name-input',
                className: 'block text-[11px] font-mono uppercase tracking-wider text-zinc-400',
              },
              'Full Name ',
              h('span', { className: 'text-indigo-400' }, '*')
            ),
            h('input', {
              type: 'text',
              id: 'name-input',
              name: 'name',
              value: form.name,
              onChange: (e) => handleInputChange('name', e.target.value),
              placeholder: 'e.g. Phạm Minh Đức',
              className: `w-full px-3.5 py-2 rounded-lg border text-zinc-100 placeholder-zinc-500 text-xs font-mono focus:outline-none transition-colors ${
                fieldErrors.name
                  ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500'
                  : 'border-zinc-800 bg-zinc-900/90 focus:border-indigo-500'
              }`,
            }),
            h(
              'span',
              {
                'data-error-for': 'name',
                className: 'min-h-[1.2rem] block text-[11px] font-mono text-rose-400',
              },
              fieldErrors.name
            )
          ),
          // Controlled Email Input
          h(
            'div',
            { className: 'sm:col-span-5 space-y-1.5' },
            h(
              'label',
              {
                htmlFor: 'email-input',
                className: 'block text-[11px] font-mono uppercase tracking-wider text-zinc-400',
              },
              'Email Address ',
              h('span', { className: 'text-indigo-400' }, '*')
            ),
            h('input', {
              type: 'email',
              id: 'email-input',
              name: 'email',
              value: form.email,
              onChange: (e) => handleInputChange('email', e.target.value),
              placeholder: 'e.g. duc.pm@student.hcmus.edu.vn',
              className: `w-full px-3.5 py-2 rounded-lg border text-zinc-100 placeholder-zinc-500 text-xs font-mono focus:outline-none transition-colors ${
                fieldErrors.email
                  ? 'border-rose-500/80 bg-rose-950/20 focus:border-rose-500'
                  : 'border-zinc-800 bg-zinc-900/90 focus:border-indigo-500'
              }`,
            }),
            h(
              'span',
              {
                'data-error-for': 'email',
                className: 'min-h-[1.2rem] block text-[11px] font-mono text-rose-400',
              },
              fieldErrors.email
            )
          ),
          // Submit Button
          h(
            'div',
            { className: 'sm:col-span-2 sm:pt-6' },
            h(
              'button',
              {
                type: 'submit',
                id: 'submit-btn',
                disabled: submitting,
                className:
                  'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black px-4 py-2 text-xs font-bold hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50',
              },
              h('span', { id: 'btn-text' }, submitting ? 'Adding...' : 'Add Student')
            )
          )
        )
      )
    );
  }

  global.AddStudentForm = AddStudentForm;
})(window);
