import './globals.css';

export const metadata = {
  title: 'TV Media Player',
  description: 'Loops images and videos on a TV for showcase purposes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
