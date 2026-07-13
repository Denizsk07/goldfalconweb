document.addEventListener("DOMContentLoaded", () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 1. Decision-Pipeline Animation (Hero-Terminal) ---------- */
    const terminal = document.getElementById("terminal");
    if (terminal && !reduced) {
        const steps = terminal.querySelectorAll("[data-step]");
        let played = false;

        const playPipeline = () => {
            if (played) return;
            played = true;
            steps.forEach(el => {
                const n = parseInt(el.dataset.step, 10);
                setTimeout(() => el.classList.add("on"), 350 + n * 480);
            });
        };

        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) playPipeline(); });
        }, { threshold: 0.35 });
        obs.observe(terminal);
    } else if (terminal) {
        terminal.querySelectorAll("[data-step]").forEach(el => el.classList.add("on"));
    }

    /* ---------- 2. Scroll-Reveals ---------- */
    const revealTargets = document.querySelectorAll(
        ".step, .feature, .not, .anatomy-notes li, .price-card, .faq details, .section-head"
    );
    revealTargets.forEach(el => el.classList.add("reveal"));

    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add("in");
                revealObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });

    revealTargets.forEach(el => revealObs.observe(el));

    /* ---------- 3. FAQ: nur ein offenes Element ---------- */
    const faqs = document.querySelectorAll(".faq details");
    faqs.forEach(d => {
        d.addEventListener("toggle", () => {
            if (d.open) faqs.forEach(o => { if (o !== d) o.open = false; });
        });
    });
});
