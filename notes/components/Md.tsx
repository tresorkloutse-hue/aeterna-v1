"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function slug(s: string) {
  return "t-" + s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function texte(children: any): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(texte).join("");
  if (children?.props?.children) return texte(children.props.children);
  return "";
}

/** Rendu Markdown : visuels du cours (visuel:<id>) et titres avec ancres. */
export default function Md({ children, visuels = {} }: { children: string; visuels?: Record<string, string> }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => u}
        components={{
          h2: ({ children }) => <h2 id={slug(texte(children))}>{children}</h2>,
          img: ({ src, alt }) => {
            const s = String(src || "");
            const url = s.startsWith("visuel:") ? visuels[s.slice(7)] : s;
            if (!url) return null;
            return (
              <a href={url} target="_blank" rel="noreferrer" className="visuel">
                <img src={url} alt={alt || "Visuel du cours"} loading="lazy" />
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function Sommaire({ md }: { md: string }) {
  const titres = md.split("\n").filter((l) => /^##\s/.test(l)).map((l) => l.replace(/^##\s+/, "").trim());
  if (titres.length < 3) return null;
  return (
    <nav className="sommaire">
      <b>Sommaire</b>
      <ol>
        {titres.map((t) => (
          <li key={t}><a href={`#${slug(t)}`}>{t.replace(/^\d+\.\s*/, "")}</a></li>
        ))}
      </ol>
    </nav>
  );
}
