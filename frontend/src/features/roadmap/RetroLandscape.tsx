import john from "../../assets/john-business.png";

export function RetroLandscape() {
  return <svg className="retro-landscape" viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="1000" height="460" fill="#76c9f2" />
    <path d="M0 90H70V60H160V90H205V120H0ZM660 55H720V30H810V55H865V85H660Z" fill="#fff9d9" />
    <path d="M0 300L120 120L270 300L380 90L560 300L730 120L950 300Z" fill="#7084b0" />
    <path d="M120 120L160 180H80ZM380 90L435 175H325ZM730 120L780 185H680Z" fill="#e6f4e8" />
    <path d="M0 310L145 245L320 290L500 220L700 275L850 230L1000 285V460H0Z" fill="#318a66" />
    <path d="M20 350L130 280L350 300L465 255L680 285L850 255L980 320L935 415L750 445L510 410L270 450L65 410Z" fill="#8b582f" stroke="#243b4b" strokeWidth="8" />
    <path d="M20 330L130 260L350 280L465 235L680 265L850 235L980 300L935 375L750 405L510 370L270 410L65 370Z" fill="#9acb55" stroke="#243b4b" strokeWidth="8" />
    <path d="M125 345L300 325L470 345L650 310L850 310" fill="none" stroke="#6e512d" strokeWidth="29" strokeLinejoin="round" />
    <path d="M125 345L300 325L470 345L650 310L850 310" fill="none" stroke="#ffe4a0" strokeWidth="19" strokeDasharray="18 5" />
    {[100,370,720,920].map((x,i) => <g key={x} transform={`translate(${x} ${i % 2 ? 258 : 240})`}><rect x="-6" y="-4" width="12" height="43" fill="#79512e"/><path d="M-30 0L0-55L30 0ZM-24-24L0-70L24-24Z" fill="#18664d" stroke="#243b4b" strokeWidth="4"/></g>)}
    <g transform="translate(820 175)"><path d="M0 70V0H20V15H40V0H60V70Z" fill="#fff0cb" stroke="#243b4b" strokeWidth="5"/><rect x="22" y="40" width="16" height="30" fill="#243b4b"/><path d="M30 0V-55H70L55-38H30" fill="#df5345" stroke="#243b4b" strokeWidth="4"/></g>
    {[225,565,790].map(x=><path key={x} d={`M${x} 250l6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2Z`} fill="#ffe17c" stroke="#725127" strokeWidth="3"/>)}
  </svg>;
}
export function JohnToken({ large = false }: { large?: boolean }) {
  return <div className={large ? "john-player large" : "john-player"}><img src={john} alt="John Business" /></div>;
}
