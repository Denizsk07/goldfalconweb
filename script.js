document.addEventListener("DOMContentLoaded", () => {
    // 1. Particle Generation and Interactive Mouse Follow
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle(particlesContainer));
    }

    // Mouse interactive effect for particles
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        particles.forEach(p => {
            const rect = p.element.getBoundingClientRect();
            const pX = rect.left + rect.width / 2;
            const pY = rect.top + rect.height / 2;
            
            const dx = mouseX - pX;
            const dy = mouseY - pY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If mouse is near particle, push it away gently
            if (distance < 150) {
                const force = (150 - distance) / 150;
                const pushX = -(dx / distance) * force * 30;
                const pushY = -(dy / distance) * force * 30;
                p.element.style.transform = `translate(${pushX}px, ${pushY}px) scale(1.2)`;
            } else {
                p.element.style.transform = `translate(0px, 0px) scale(1)`;
            }
        });
    });

    // 2. Scroll Reveal Animations (Apple-style fade ins)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .proof-card').forEach(el => {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
        observer.observe(el);
    });
});

function createParticle(container) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // Randomize properties
    const size = Math.random() * 4 + 1; // 1px to 5px
    const leftPos = Math.random() * 100; // 0% to 100%
    const animDuration = Math.random() * 8 + 8; // 8s to 16s
    const delay = Math.random() * 5; // 0s to 5s
    
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${leftPos}%`;
    particle.style.animationDuration = `${animDuration}s`;
    particle.style.animationDelay = `${delay}s`;
    
    container.appendChild(particle);
    return { element: particle };
}
