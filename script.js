document.addEventListener("DOMContentLoaded", () => {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 40;

    for (let i = 0; i < particleCount; i++) {
        createParticle(particlesContainer);
    }
});

function createParticle(container) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // Randomize properties
    const size = Math.random() * 4 + 1; // 1px to 5px
    const leftPos = Math.random() * 100; // 0% to 100%
    const animDuration = Math.random() * 10 + 5; // 5s to 15s
    const delay = Math.random() * 5; // 0s to 5s
    
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${leftPos}%`;
    particle.style.animationDuration = `${animDuration}s`;
    particle.style.animationDelay = `${delay}s`;
    
    container.appendChild(particle);
}
