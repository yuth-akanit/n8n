/**
 * AC & Freezer Service Website - Main JavaScript
 * Handles navigation, UI interactions, and form handling
 */

// Mobile menu toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const nav = document.querySelector('nav');

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', () => {
    nav?.classList.toggle('active');
    mobileMenuToggle.setAttribute('aria-expanded', nav?.classList.contains('active'));
  });
}

// Close mobile menu when clicking a link
document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav?.classList.remove('active');
  });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('header')) {
    nav?.classList.remove('active');
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') {
      e.preventDefault();
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Form handling
const contactForm = document.querySelector('form[data-form="contact"]');
if (contactForm) {
  contactForm.addEventListener('submit', handleContactForm);
}

function handleContactForm(e) {
  e.preventDefault();

  const formData = new FormData(this);
  const data = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    service: formData.get('service'),
    timestamp: new Date().toISOString()
  };

  // Validate required fields
  if (!data.name || !data.phone || !data.message) {
    showAlert('โปรดกรอกข้อมูลที่จำเป็นครบถ้วน', 'danger');
    return;
  }

  // Validate phone number
  if (!isValidPhoneNumber(data.phone)) {
    showAlert('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณาตรวจสอบ', 'danger');
    return;
  }

  // In real application, send to server
  console.log('Form data:', data);

  // Store in localStorage temporarily
  let submissions = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
  submissions.push(data);
  localStorage.setItem('contactSubmissions', JSON.stringify(submissions));

  // Show success message
  showAlert('ขอบคุณที่ติดต่อ! ช่างของเราจะติดต่อคุณในเร็ว ๆ นี้ 😊', 'success');
  this.reset();

  // In production, send to backend API:
  // fetch('/api/contact', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // });
}

function isValidPhoneNumber(phone) {
  // Thai phone number format
  const phoneRegex = /^(\+66|0)\d{8,9}$/;
  const cleanPhone = phone.replace(/[\s-]/g, '');
  return phoneRegex.test(cleanPhone);
}

// Alert/Toast notifications
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '20px';
  alertDiv.style.right = '20px';
  alertDiv.style.zIndex = '3000';
  alertDiv.style.maxWidth = '400px';
  alertDiv.style.animation = 'slideIn 0.3s ease-in-out';

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.style.animation = 'slideOut 0.3s ease-in-out';
    setTimeout(() => alertDiv.remove(), 300);
  }, 4000);
}

// Service filter/search
const serviceFilter = document.querySelector('[data-service-filter]');
if (serviceFilter) {
  serviceFilter.addEventListener('change', (e) => {
    const selected = e.target.value;
    document.querySelectorAll('.service-card').forEach(card => {
      if (selected === 'all' || card.dataset.service === selected) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// Rating stars
document.querySelectorAll('.rating-input').forEach(rating => {
  const stars = rating.querySelectorAll('.star');
  const input = rating.querySelector('input');

  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      input.value = index + 1;
      stars.forEach((s, i) => {
        s.classList.toggle('active', i < index + 1);
      });
    });

    star.addEventListener('mouseover', () => {
      stars.forEach((s, i) => {
        s.classList.toggle('hover', i <= index);
      });
    });
  });

  rating.addEventListener('mouseout', () => {
    stars.forEach(s => s.classList.remove('hover'));
  });
});

// Lazy loading for images
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src || img.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img.lazy').forEach(img => {
    imageObserver.observe(img);
  });
}

// Track scroll position for header
let lastScrollTop = 0;
const header = document.querySelector('header');
if (header) {
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 100) {
      header.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.12)';
    } else {
      header.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
    }

    lastScrollTop = scrollTop;
  });
}

// Initialize tooltips
document.querySelectorAll('[data-tooltip]').forEach(el => {
  el.addEventListener('mouseenter', (e) => {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = el.dataset.tooltip;
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.zIndex = '1000';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.whiteSpace = 'nowrap';

    document.body.appendChild(tooltip);

    const rect = el.getBoundingClientRect();
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';

    el.addEventListener('mouseleave', () => tooltip.remove(), { once: true });
  });
});

// Analytics tracking (can be replaced with actual analytics)
function trackEvent(eventName, eventData = {}) {
  console.log(`Event: ${eventName}`, eventData);
  // Send to analytics service
  // gtag('event', eventName, eventData);
}

// Track CTA button clicks
document.querySelectorAll('.cta-call, .btn-primary').forEach(btn => {
  btn.addEventListener('click', () => {
    trackEvent('cta_click', {
      buttonText: btn.textContent,
      page: window.location.pathname
    });
  });
});

// Track service card views
document.querySelectorAll('.service-card').forEach(card => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      trackEvent('service_view', {
        service: card.dataset.service || 'unknown'
      });
      observer.unobserve(card);
    }
  });
  observer.observe(card);
});

// CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .tooltip {
    animation: fadeIn 0.2s ease-in-out;
  }
`;
document.head.appendChild(style);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('AC & Freezer Service website loaded successfully!');

  // Preload images
  const links = document.querySelectorAll('link[rel="preload"][as="image"]');
  links.forEach(link => {
    new Image().src = link.href;
  });
});

// Service worker registration (for offline capability)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.log('ServiceWorker registration failed: ', err);
  });
}
