const BOOKD_WHATSAPP_NUMBER = '96170511815';
const BUILD_PORTFOLIO_MESSAGE = 'i am interested in building my portfolio';

export function buildPortfolioWhatsappUrl(): string {
  return `https://wa.me/${BOOKD_WHATSAPP_NUMBER}?text=${encodeURIComponent(BUILD_PORTFOLIO_MESSAGE)}`;
}
