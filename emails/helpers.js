export const emailWrapper = ({ headerColor, title, content }) => `
<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
  <div style="background:${headerColor};color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">${title}</h2>
  </div>

  <div style="padding:24px;color:#111827;">
    ${content}
  </div>
</div>
`;

export const summaryBox = ({ text, bg = "#f3f4f6", color = "#111827" }) => `
<div style="margin-top:20px;padding:15px;background:${bg};border-radius:8px;">
  <p style="margin:0;font-size:18px;font-weight:bold;color:${color};">
    ${text}
  </p>
</div>
`;

export const divider = () => `
<hr style="margin:20px 0;" />
`;
