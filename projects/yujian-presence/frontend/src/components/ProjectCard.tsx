import React from 'react';

interface Props {
  id: string;
  title: string;
  desc: string;
  status: string;
}

const ProjectCard: React.FC<Props> = ({ id, title, desc, status }) => {
  return (
    <div className="bg-surface rounded-2xl p-6 border border-[#222] hover:border-primary transition-all cursor-pointer group hover:-translate-y-1">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[9px] font-black text-secondary/30 group-hover:text-primary/50 transition-colors tracking-tighter">#{id}</span>
        <span className="text-[8px] px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-black group-hover:bg-primary/20 group-hover:text-primary transition-colors">{status}</span>
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-secondary text-xs leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{desc}</p>
    </div>
  );
};

export default ProjectCard;
