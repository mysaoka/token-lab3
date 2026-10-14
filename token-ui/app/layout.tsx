import "./globals.css";
export const metadata = {title: "KWNcoin · Лабораторная работа 3", description: "Учебный интерфейс токена ERC-20 в Sepolia"};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="ru"><body>{children}</body></html>;
}
