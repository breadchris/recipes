import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About | recipes',
  description: 'How I came to cooking through fatigue, and built a site to help you learn to pay attention.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-8"
        >
          <span>←</span>
          <span>Back to recipes</span>
        </Link>

        <article className="space-y-6">
          <header>
            <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8">
              About
            </h1>
          </header>

          <section className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>
              I didn't learn to cook because I loved food.
            </p>
            <p>
              I learned to cook because I got tired of not caring.
            </p>

            <p>
              For a long time, eating was purely functional. Efficient. Forgettable. I fed myself, but I didn't really <em>cook</em>. And I didn't expect much from what was on the plate.
            </p>

            <p>
              That changed slowly, and then all at once.
            </p>

            <p>
              I started noticing when food had been treated with care—and when it hadn't. Chicken that stayed juicy. Eggs that smelled rich instead of sulfurous. Vegetables that tasted like something you'd look forward to eating again. Once you notice that difference, it's hard to unsee it.
            </p>

            <p>
              What surprised me was how I learned.
            </p>

            <p>
              It wasn't from memorizing recipes or reading cover-to-cover cookbooks. It was from watching people cook—really watching. Seeing someone pause, adjust the heat, taste, change course. Hearing <em>why</em> they were doing something, not just <em>what</em> they were doing.
            </p>

            <p>
              That's when cooking stopped feeling intimidating.
            </p>

            <p>
              I built this because cooking stopped being intimidating the moment I realized it wasn't about following instructions.
            </p>
            <p>
              It was about learning to pay attention.
            </p>

            <p>
              Paying attention to what's in the pan.<br />
              To how something smells before it burns.<br />
              To the moment when "five more minutes" is the difference between good and great.
            </p>

            <p>
              Traditional recipes struggle to teach that. They're linear in a world that isn't. They assume perfect conditions: the right pan, the right stove, the right ingredients, the right timing. Real kitchens don't work that way.
            </p>

            <p>
              Videos get closer. They show judgment in motion. But they're often hard to cook <em>with</em>. Too fast. Too fragmented. Too easy to lose your place once your hands are dirty and the clock is running.
            </p>

            <p>
              This site lives in the space between.
            </p>

            <p>
              Here, recipes are grounded in cooking you can see and hear, from creators who explain their thinking as they go. The structure is there to support you—not to boss you around. When something goes off-script, you're not failing. You're learning the part that actually matters.
            </p>

            <p>
              Because the goal isn't perfect execution.
            </p>
            <p>
              It's confidence.
            </p>

            <p>
              Confidence to substitute.<br />
              To turn on the broiler when the skin isn't crisping.<br />
              To fix a sauce instead of throwing it out.<br />
              To make dinner again tomorrow.
            </p>

            <p>
              If this helps you cook one meal with a little more attention—or recover from one that didn't go as planned—then it's working.
            </p>

            <p>
              Everything here is built around that idea.
            </p>
          </section>

          <section className="pt-4">
            <Link
              href="/"
              className="text-zinc-900 dark:text-zinc-100 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              Start exploring recipes →
            </Link>
          </section>
        </article>
      </div>
    </div>
  );
}
