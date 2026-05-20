// Empty PostCSS config — we don't use Tailwind (per design-language.md, Novus is the
// styling layer in M2+). Next.js's default PostCSS pipeline assumes tailwindcss is
// available; this file overrides that to a no-op.
module.exports = {
  plugins: {},
};
