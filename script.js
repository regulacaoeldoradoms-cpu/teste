const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSen4AWwj77om-MT4NiOiC2JozDlAOsIVpGtqBRVeIIuaDH1JQ/viewform?usp=header';

function openForm() {
  window.open(FORM_URL, '_blank', 'noopener,noreferrer');
}

document.querySelectorAll('.open-form').forEach((button) => {
  button.addEventListener('click', openForm);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.12
});

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
