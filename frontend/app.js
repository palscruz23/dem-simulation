const form = document.getElementById('run-form');
const output = document.getElementById('output');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  for (const key of Object.keys(payload)) {
    payload[key] = Number(payload[key]);
  }

  output.textContent = 'Submitting run...';

  try {
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = `Request failed: ${error}`;
  }
});
