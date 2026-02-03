import React from 'react';

interface Props {
  lang: 'zh' | 'en';
  onLangToggle: () => void;
  t: any;
}

const Navbar: React.FC<Props> = ({ lang, onLangToggle, t }) => {
  return (
    <nav className="border-b border-[#222] bg-bg/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold tracking-tighter text-xl text-primary cursor-pointer">YJ.LAB</span>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-secondary">
            <a href="#" className="hover:text-primary transition-colors text-primary cursor-pointer">{t.nav.home}</a>
            <a href="https://lab.yujian.team" className="hover:text-primary transition-colors cursor-pointer">{t.nav.lab}</a>
            <a href="https://trade.yujian.team" className="hover:text-primary transition-colors cursor-pointer">{t.nav.trade}</a>
            <a href="/api" className="hover:text-primary transition-colors cursor-pointer">{t.nav.api}</a>
          </div>
        </div>
        <button 
          onClick={onLangToggle}
          className="px-3 py-1 border border-[#333] rounded-md text-[10px] hover:border-primary transition-colors uppercase font-bold cursor-pointer"
        >
          {lang === 'zh' ? 'English' : '中文'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
