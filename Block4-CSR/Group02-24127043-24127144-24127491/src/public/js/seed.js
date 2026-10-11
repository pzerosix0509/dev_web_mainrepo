(function (global) {
  const AVATAR_COLORS = [
    'bg-indigo-950/80 text-indigo-300 border border-indigo-700/40',
    'bg-purple-950/80 text-purple-300 border border-purple-700/40',
    'bg-cyan-950/80 text-cyan-300 border border-cyan-700/40',
    'bg-emerald-950/80 text-emerald-300 border border-emerald-700/40',
    'bg-amber-950/80 text-amber-300 border border-amber-700/40',
    'bg-rose-950/80 text-rose-300 border border-rose-700/40',
  ];

  function enrichStudent(student, index) {
    const parts = (student.name || '').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length > 0
      ? parts.slice(-2).map((p) => p[0]).join('').toUpperCase()
      : 'ST';

    return {
      id: String(student.id),
      name: student.name,
      email: student.email,
      initials: student.initials || initials,
      avatarColor: student.avatarColor || AVATAR_COLORS[index % AVATAR_COLORS.length],
    };
  }

  // Initial seed data matching Block #1 / Block #3
  const RAW_SEED = [
    { id: '1728100000001', name: 'Nguyễn Văn An', email: 'an.nguyen@example.com' },
    { id: '1728100000002', name: 'Trần Thị Bình', email: 'binh.tran@example.com' },
    { id: '1728100000003', name: 'Lê Hoàng Cường', email: 'cuong.le@example.com' },
    { id: '1791164915108', name: 'Tuan Van', email: 'tdpus06@gmail.com' },
    { id: '1791166904808', name: 'Duy Phu', email: 'tdp@dev.com' },
  ];

  global.TDP_SEED = {
    SEED_STUDENTS: RAW_SEED.map(enrichStudent),
    enrichStudent,
  };
})(window);
