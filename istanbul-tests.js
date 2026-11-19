
/* Appended to istanbul's block-navigation.js after the report is written: a line number that tests ran is underlined,
   and clicking it lists those tests, read from the tests.json at the report's root. */
(function showTestsPerLine() {
  const numbers = document.querySelectorAll('td.line-count a[href^="#L"]');
  const home = document.querySelector('.pad1 h1 a');
  if (!numbers.length || !home) return;
  const root = new URL('.', home.href);
  const page = decodeURIComponent(location.pathname.slice(root.pathname.length)).replace(/\.html$/, '');

  fetch(new URL('tests.json', root)).then((response) => (response.ok ? response.json() : null)).then((data) => {
    const file = data && Object.keys(data.files).find((path) => path === page || path.endsWith(`/${page}`));
    if (!file) return;
    const byLine = data.files[file];
    let open = null;

    const close = () => {
      if (open) open.remove();
      open = null;
    };

    for (const number of numbers) {
      const line = number.getAttribute('href').slice(2);
      const tests = byLine[line];
      if (!tests) continue;
      number.classList.add('has-tests');
      number.title = `${tests.length} test${tests.length === 1 ? '' : 's'} ran this line`;
      number.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const same = open && open.dataset.line === line;
        close();
        if (same) return;
        open = document.createElement('div');
        open.className = 'tests-popover';
        open.dataset.line = line;
        const heading = document.createElement('strong');
        heading.textContent = `Line ${line}: ${number.title}`;
        const list = document.createElement('ul');
        for (const index of tests) {
          const item = document.createElement('li');
          item.textContent = data.tests[index];
          list.append(item);
        }
        open.append(heading, list);
        const box = number.getBoundingClientRect();
        open.style.left = `${box.right + window.scrollX + 8}px`;
        open.style.top = `${box.top + window.scrollY}px`;
        document.body.append(open);
      });
    }
    document.addEventListener('click', (event) => {
      if (open && !open.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  });
})();
