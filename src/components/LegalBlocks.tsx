import React from 'react';

/**
 * Renders the verbatim sub-section headers, Legal Notices, Statutory Notices,
 * and Oath Portal blocks at their exact positions in the PDF sequence.
 */

export const ResidentInfoHeaderBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-[#F8FAFC] border-l-4 border-[#1E3A8A] border-y border-r border-slate-300 px-3 py-2 my-1">
    <h4 className="text-xs font-bold underline text-[#0F2942] tracking-wide">
      Resident Information
    </h4>
    <p className="text-xs font-semibold text-slate-800 font-hindi italic mt-0.5">
      इस भाग में विद्यार्थी/शिक्षार्थी/क्लाइंट सिर्फ अपने आवेदन से संबंधित स्थायी अथवा वर्तमान लोकैशन के बारे मे आवश्यक जानकारी साँझा करे
    </p>
    <p className="text-xs font-semibold text-[#1E3A8A] font-hindi italic underline mt-0.5">
      आप अपने वार्ड/ब्लॉक/गाँव/नगर पालिका/शहर/जिले/राज्य/देश के कॉड की जानकारी भारत सरकार की इस आधिकारिक वेबसाईट से प्राप्त कर सकते है।
    </p>
    <a
      href="https://lgdirectory.gov.in/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-[#1D4ED8] underline hover:text-[#1E3A8A] inline-block mt-0.5"
    >
      https://lgdirectory.gov.in/
    </a>
  </div>
);

export const LiveFeeStatusHeaderBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-[#F8FAFC] border-l-4 border-[#1E3A8A] border-y border-r border-slate-300 px-3 py-2 my-1">
    <h4 className="text-xs font-bold text-[#0F2942]">Live Fee Status</h4>
    <p className="text-xs text-slate-800 font-hindi mt-0.5">
      कितनी फीस जमा है कितनी बकाया है उसका विवरण भरो।
    </p>
  </div>
);

export const BankLegalNoticeAndQrBlock: React.FC<{ bankQrCardPng: string }> = ({
  bankQrCardPng,
}) => (
  <div className="mt-2 mb-2 bg-[#FFFBEB]/70 border border-amber-300 rounded-sm p-3">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className="lg:col-span-8 space-y-1.5 text-xs text-slate-900 font-hindi leading-relaxed">
        <p className="font-bold text-[#991B1B] text-sm">
          अति-महत्वपूर्ण विधिक सूचना / LEGAL NOTICE
        </p>
        <p className="font-bold text-slate-900">
          सर्वसंबंधितों हेतु अनिवार्य एवं अंतिम चेतावनी:
        </p>
        <p>
          एतद्द्वारा समस्त नामांकनकर्ताओं, आवेदकों एवं अभिभावकों को सूचित किया जाता है कि{' '}
          <strong>'नव्या'</strong> द्वारा संचालित{' '}
          <strong>NAND VIDHYA EDUCATION ACADEMY (NVEA)</strong> के समस्त प्रकार के शुल्कों के
          हस्तांतरण हेतु केवल निम्नलिखित <strong>चालू बैंक खाता (Current Account)</strong> ही विधिक
          रूप से अधिकृत है:
        </p>
        <ul className="list-disc list-inside pl-2 space-y-0.5 bg-white border border-slate-300 p-2 rounded-sm font-medium">
          <li>
            <strong>खाताधारक:</strong> NAND VIDHYA EDUCATION ACADEMY
          </li>
          <li>
            <strong>खाता संख्या:</strong> <span className="font-mono-num font-bold">104321010000244</span>
          </li>
          <li>
            <strong>IFSC Code:</strong> <span className="font-mono-num font-bold">UBIN0910431</span>
          </li>
        </ul>
        <p className="font-bold text-slate-900 pt-1">
          विधिक प्रतिबंध एवं दायित्व-मुक्ति शर्तें (Mandatory Legal Terms):
        </p>
        <ol className="list-decimal list-inside space-y-1 pl-1">
          <li>
            <strong>एकमात्र अधिकृत खाता:</strong> उपरोक्तानुसार दर्शित बैंक खाते के अतिरिक्त संस्थान
            का अन्य कोई बैंक खाता, UPI अथवा मध्यस्थ अधिकृत नहीं है।
          </li>
          <li>
            <strong>दायित्व का पूर्ण अभाव:</strong> उक्त निर्धारित खाते के अतिरिक्त किसी अन्य खाते,
            व्यक्ति या संस्था को भुगतान किए जाने की दशा में संस्थान <strong>'नव्या/NVEA'</strong>{' '}
            प्रत्यक्ष, अप्रत्यक्ष या विधिक रूप से शून्य उत्तरदायी (Zero Liable) रहेगी।
          </li>
          <li>
            <strong>रिफंड दावों का स्वतः निरस्तीकरण:</strong> किसी अनधिकृत खाते में जमा शुल्क के
            विरुद्ध संस्थान के समक्ष <strong>शुल्क वापसी (Fee Refund)</strong>, क्षतिपूर्ति या रसीद
            का कोई विधिक अधिकार उत्पन्न नहीं होगा।
          </li>
          <li>
            <strong>न्यायिक वाद से छूट:</strong> ऐसा कोई भी अनधिकृत भुगतानकर्ता किसी भी सक्षम
            न्यायालय, उपभोक्ता फोरम या न्यायिक/अर्ध-न्यायिक प्राधिकारी के समक्ष{' '}
            <strong>'नव्या/NVEA'</strong> के विरुद्ध क्लेम या वाद (Lawsuit/Claim) प्रस्तुत करने हेतु
            स्वतः ही अनधिकृत (Disqualified) रहेगा तथा संस्थान के विरुद्ध किया गया समस्त रिफंड दावा
            कानूनी रूप से अमान्य (Null and Void) माना जाएगा।
          </li>
        </ol>
        <div className="pt-1.5 font-bold text-slate-900">
          <p>आज्ञा से,</p>
          <p>अधिकृत हस्ताक्षरकर्ता</p>
          <p>NAND VIDHYA EDUCATION ACADEMY (NVEA)</p>
        </div>
      </div>

      {/* Official Union Bank QR Code Card (Pages 60-61) */}
      <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white border border-slate-300 p-2 rounded-sm">
        {bankQrCardPng ? (
          <img
            src={bankQrCardPng}
            alt="Union Bank of India Official Scan & Pay QR Code - UPI ID: 72923201@ubin"
            referrerPolicy="no-referrer"
            className="w-full max-w-[240px] h-auto object-contain border border-slate-200"
          />
        ) : (
          <div className="w-[220px] h-[280px] flex items-center justify-center bg-slate-50 text-xs text-slate-500">
            Official Bank QR Code
          </div>
        )}
        <p className="text-[11px] font-mono-num font-bold text-[#0F2942] mt-1.5 text-center">
          UPI ID: 72923201@ubin
        </p>
      </div>
    </div>
  </div>
);

export const OathDeclarationPortalIntroBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-[#F8FAFC] border border-slate-300 border-l-4 border-l-[#0F2942] p-3 my-1 text-xs text-slate-900 font-hindi space-y-1.5 leading-relaxed">
    <h4 className="font-bold text-sm text-[#0F2942]">1. Oath Declaration Portal</h4>
    <p>
      यदि नामांकित/शपथकर्ता की जन्म तिथि के अनुसार उसकी आयु 18 वर्ष से कम है, तो यह शपथ/घोष्णा केवल
      उसके वैध अभिभावक/ अभिभाविका द्वारा ही वैधानिक रूप
    </p>
    <p>
      (<em>भारतीय वयस्कता अधिनियम, 1875 की धारा 3 तथा भारतीय अनुबंध अधिनियम, 1872 की धारा 10 के अंतर्गत</em>
      ) से स्वीकार्य होगी और अभिभावक/अभिभाविका का नाम,
    </p>
    <p>
      हस्ताक्षर तथा सम्बन्धित पहचान-पत्र संख्या इस शपथ-पत्र पर अनिवार्य रूप से संलग्न की जानी चाहिए।
      यदि नामांकित/ शपथकर्ता की आयु 18 वर्ष या अधिक है, तो वह स्वयं इस
    </p>
    <p>
      शपथ/घोष्णा (
      <em>भारतीय साक्ष्य अधिनियम, 1872 व सूचना प्रौद्योगिकी अधिनियम, 2000 के अंतर्गत</em>) को पूर्ण
      विवेक एवं स्वतंत्र सहमति से स्वीकार करता/करती है तथा अपने
    </p>
    <p>
      हस्ताक्षर द्वारा (अपने मूल आधार कार्ड की फोटो प्रतिलिपि पर) इसे प्रमाणित करेगा/करेगी।
    </p>
  </div>
);

export const OathSection1And2HeaderBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-white border border-slate-300 p-3 my-1.5 text-xs text-slate-900 font-hindi space-y-2 leading-relaxed">
    <div className="bg-[#EFF6FF] border-l-4 border-[#1E3A8A] p-2.5 space-y-1">
      <p className="font-semibold text-slate-900">अपना आधिकारिक बयान रिकार्ड दर्ज कराता हूँ। कि</p>
      <p className="font-bold italic text-[#0F2942]">
        भारतीय शपथ अधिनियम, 1969 (Oaths Act, 1969) तथा साक्ष्य अधिनियम, 1872 (Indian Evidence Act,
        1872) के अंतर्गत
      </p>
      <p>
        शपथकर्ता द्वारा प्रवेशार्थी के CLAP Course/Class/Program मे नामांकन प्रक्रिया के बाबत
        नामांकन हेतु अपने स्वयं के आधार कार्ड की फोटो प्रति लिपि पर लिखित हस्ताक्षर करते हुए ऑनलाइन
        डिजिटल सहमति एवं स्वीकृति प्रदान करने बाबत आधिकारिक बयान दर्ज कराते हुए मैं शपथपूर्वक यह
        घोषणा करता/करती हूँ कि –
      </p>
    </div>

    <div className="space-y-1.5 pt-1">
      <h4 className="font-bold text-sm text-[#0F2942]">1. संस्थान संबंधी सत्यापन</h4>
      <p>
        <strong>1.1. NAND VIDHYA EDUCATION ACADEMY (संक्षेप में “NVEA/नव्या ”)</strong> एक स्वतंत्र,
        वैधानिक रूप से शैक्षिक संस्थान है। इसकी स्थापना वर्ष 2006 में स्व. नन्द किशोर मुंडेल की
        स्मृति में की गई।
      </p>
      <p>
        1.2. NVEA के सभी ऑनलाइन पंजीकरण (DES,RPC &amp; DOL, Department of Rajasthan /
        MSME,ISBN,DGFT,CBIC,MOF &amp; FSSAI,NITI AAYOG,NCS,GEM,CPPP,MY Bharat Partner,Start Up
        India, Government of India/ Accredited by ICANN/Whois :{' '}
        <strong>वैध, सक्रिय और न्यायालयीन दृष्टि से प्रमाणिक</strong> हैं।
      </p>
      <p>
        1.3. मैं स्पष्ट रूप से स्वीकार करता/करती हूँ कि{' '}
        <strong>
          NVEA किसी भी रूप में कोचिंग सेंटर नहीं है। यह केवल और केवल ऑनलाइन शैक्षणिक और क्रिएटिव
          लर्निंग एक्टिविटी प्रोग्राम्स (CLAP, Creative Learning Activity Program) संचालित करता है,
        </strong>{' '}
        और इसे किसी भी तरह कोचिंग, ट्यूशन या ऑफ़लाइन शिक्षण केंद्र के रूप में नहीं माना जा सकता।
      </p>
      <p>
        1.4 मुझे अच्छी तरह से पता है कि नव्या, नन्द विध्या शिक्षण संस्थान/NVEA, NAND VIDHYA
        EDUCATION ACADEMY की आधिकारिक{' '}
        <a
          href="https://www.nvea.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1D4ED8] underline font-semibold"
        >
          https://www.nvea.in/
        </a>{' '}
        वेबसाईट है। एवं आधिकारिक हेल्पलाइन <strong>09414008310</strong> नंबर है।
      </p>
    </div>

    <div className="pt-1 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">2. नामांकन स्थिति और सीमा</h4>
    </div>
  </div>
);

export const StatutoryNoticeIntakeLimitBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-[#FEF2F2]/60 border border-red-300 border-l-4 border-l-[#991B1B] p-3 my-1.5 text-xs text-slate-900 font-hindi space-y-1.5 leading-relaxed">
    <h4 className="font-bold text-sm text-[#991B1B]">विधिक अधिसूचना / STATUTORY NOTICE</h4>
    <p className="font-semibold">
      <strong>विषय:</strong> वर्तमान सत्र/बैच/सेमेस्टर हेतु अधिकतम अनिवार्य नामांकन सीमा (Maximum
      Legal Enrollment Intake Limit)।
    </p>
    <p>
      एतद्द्वारा सर्वसंबंधितों को सूचित किया जाता है कि{' '}
      <strong>NAND VIDHYA EDUCATION ACADEMY (NVEA)</strong> के अंतर्गत संचालित{' '}
      <strong>वर्तमान सत्र / बैच / सेमेस्टर / अवधि</strong> हेतु कुल अधिकतम अनिवार्य नामांकनकर्ताओं
      की संख्या{' '}
      <strong>गंभीरतापूर्वक एवं विधिक रूप से 100 (सौ) तक ही सीमित एवं निर्धारित</strong> (Strictly
      Capped &amp; Fixed at 100) की गई है।
    </p>
    <p className="font-bold">अनिवार्य विधिक विनियम (Mandatory Statutory Terms):</p>
    <ol className="list-decimal list-inside space-y-1 pl-1">
      <li>
        <strong>अंतिम बाध्यकारी सीमा (Strict Ceiling Limit):</strong> संस्थान में कुल नामांकनों की
        संख्या 100 होने पर प्रवेश प्रक्रिया स्वतः (ipso facto) बंद मानी जाएगी। 100 की स्वीकृत विधिक
        सीमा से अधिक (Exceeding Intake Capacity of 100) एक भी अतिरिक्त नामांकन स्वीकार नहीं किया
        जाएगा।
      </li>
      <li>
        <strong>अधिकार एवं दावों का स्वतः निरस्तीकरण (Null &amp; Void Claims):</strong> 100
        नामांकनों की पूर्णता के पश्चात प्रवेश हेतु प्रस्तुत किया गया कोई भी आवेदन, भुगतान अथवा दावा
        विधि की दृष्टि में <strong>शून्य एवं अप्रभावी (Void Ab Initio)</strong> माना जाएगा, जिसके
        लिए संस्थान विधिक रूप से उत्तरदायी नहीं होगा।
      </li>
    </ol>
    <div className="pt-1 font-bold text-slate-900">
      <p>आज्ञा से,</p>
      <p>अधिकृत हस्ताक्षरकर्ता / सक्षम प्राधिकारी</p>
      <p>NAND VIDHYA EDUCATION ACADEMY (NVEA)</p>
    </div>
  </div>
);

export const OathDetailedClausesBlock: React.FC = () => (
  <div className="col-span-4 legal-block-print bg-white border border-slate-300 p-3.5 my-1.5 text-xs text-slate-900 font-hindi space-y-2.5 leading-relaxed">
    {/* Page 82 */}
    <div className="bg-[#F8FAFC] border border-slate-300 p-2.5 space-y-1">
      <h4 className="font-bold text-sm text-[#0F2942]">
        शुल्क-भुगतान संबंधी स्पष्ट विधिक अस्वीकरण
      </h4>
      <p>
        यह शपथपत्र केवल आवेदक/अभिकर्ता द्वारा प्रस्तुत विवरणों, नियमों एवं शर्तों की स्वीकृति एवं
        घोषणा तक सीमित है; इसे किसी भी दशा में{' '}
        <strong>
          शुल्क भुगतान, शुल्क प्राप्ति, शुल्क समायोजन, शुल्क देयता के निर्वहन अथवा किसी
          भुगतान-संबंधी अधिकार/दावे के साक्ष्य, प्रमाण, रसीद या स्वीकृति
        </strong>{' '}
        के रूप में न तो पढ़ा जाएगा, न समझा जाएगा और न ही उद्धृत किया जा सकेगा। आवेदक द्वारा शुल्क जमा
        किया गया है, नहीं किया गया है, आंशिक रूप से जमा किया गया है अथवा कोई राशि बकाया है—इनमें से
        किसी भी स्थिति का निर्धारण अथवा प्रमाणीकरण इस शपथपत्र से नहीं होता; शुल्क संबंधी स्थिति केवल
        संस्थान के पृथक आधिकारिक अभिलेख/रसीद/लेखा-प्रविष्टि के आधार पर ही निर्धारित होगी।
      </p>
    </div>

    {/* Page 83 & 84 */}
    <div className="space-y-1.5">
      <p className="font-semibold text-slate-600">Continue..........................</p>
      <p>
        2.2. मैं पूर्णतया स्वीकार करता/करती हूँ कि{' '}
        <strong>
          NVEA की नीति के अनुसार किसी भी समय में केवल अधिकतम 100 लर्नर्स को ही वैध रूप से नामांकित
          किया जाएगा।
        </strong>
      </p>
      <p>
        2.3. यदि किसी कारणवश 101वाँ या उससे अधिक नामांकन हो जाता है, तो वह{' '}
        <strong>स्वतः Null &amp; Void, Illegal &amp; Unenforceable</strong> होगा।
      </p>
      <p>
        2.4. इस प्रकार की किसी भी अतिरिक्त नामांकन स्थिति में{' '}
        <strong>
          संस्था, निदेशक, प्रबंधन या कर्मचारी किसी भी सिविल या क्रिमिनल दायित्व के लिए उत्तरदायी
          नहीं होंगे
        </strong>
        , और ऐसे किसी भी विवाद को न्यायालय द्वारा <strong>पूर्णतः अमान्य और खारिज</strong> माना
        जाएगा।
      </p>

      <p className="font-bold italic text-[#0F2942] pt-1">
        2.5 क्रमांक संख्या की सतत वैधता एवं शुल्क वापसी प्रावधान
      </p>
      <p className="font-bold">धारा 1 : क्रमांक संख्या की वैधता (Validity of Serial Number)</p>
      <p>
        <strong>1.1</strong> यदि कोई अभ्यर्थी (Student) NVEA के अंतर्गत किसी भी निर्धारित शैक्षणिक
        अवधि/सत्र — जैसे मासिक (Monthly), त्रैमासिक (Quarterly), अर्धवार्षिक (Half-Yearly), वार्षिक
        (Yearly), सेमेस्टर (Semester), बैच (Batch) अथवा चरणीय अवधि (Stage) — का पैकेज ग्रहण करता है
        तथा उसकी संपूर्ण शुल्क राशि विधिपूर्वक जमा करता है, तो उक्त अवधि की समाप्ति के पश्चात भी, यदि
        अभ्यर्थी अपना अध्ययन निरंतर जारी रखना चाहता है, तो उसे किसी भी प्रकार के{' '}
        <strong>नवीन नामांकन अथवा पुनः पंजीकरण (Re-Enrollment / Re-Registration)</strong> की
        आवश्यकता नहीं होगी।
      </p>
      <p>
        <strong>1.2</strong> ऐसे प्रत्येक अभ्यर्थी का पंजीकरण, उसके पूर्व प्रदत्त{' '}
        <strong>क्रमांक संख्या (Original Serial Number)</strong> के अंतर्गत ही विधिक दृष्टि से वैध,
        प्रभावी एवं बाध्यकारी माना जाएगा।
      </p>
      <p>
        <strong>1.3</strong> अभ्यर्थी की यह विधिक बाध्यता होगी कि वह NVEA द्वारा उपलब्ध कराए गए नये
        अथवा अद्यतन पैकेज हेतु निर्धारित शुल्क राशि का समय पर विधिपूर्वक भुगतान करे। शुल्क की
        अदायगी के साथ ही, अभ्यर्थी का अध्ययन-पैकेज उसी क्रमांक संख्या से स्वतः, सतत एवं वैध रूप से
        आगे बढ़ता रहेगा।
      </p>

      <p className="font-bold pt-1">धारा 2 : शुल्क वापसी (Refund Policy)</p>
      <p>
        <strong>2.1</strong> शुल्क वापसी <strong>(CLAP कोर शुल्क (Core Fee के संदर्भ)</strong> केवल
        और केवल चालू अवधि/सत्र/सेमेस्टर की <strong>शेष अवधि (Remaining Period)</strong> के अनुपात में
        ही देय होगी।
      </p>
      <p>
        <strong>2.2</strong> जिस अवधि/सत्र/सेमेस्टर का उपभोग अभ्यर्थी द्वारा पूर्णतया कर लिया गया है
        अथवा जो अवधि बीत चुकी है, उसके संबंध में किसी भी प्रकार की शुल्क वापसी (Refund) देय नहीं
        होगी।
      </p>
      <p>
        <strong>2.3</strong> यदि अभ्यर्थी ने आगामी अवधि/सत्र/सेमेस्टर हेतु शुल्क पूर्व में जमा कर
        दिया है और उसका उपयोग अब तक प्रारंभ नहीं हुआ है, तो केवल उस शेष अप्रयुक्त अवधि के
        अनुपातानुसार ही शुल्क वापसी अनुमन्य होगी।
      </p>
      <p>
        <strong>2.4</strong> शुल्क वापसी किसी भी दशा में पूर्ण (100%) नहीं होगी; यह केवल
        अनुपातानुसार शेष अवधि तक ही सीमित होगी।
      </p>

      <p className="font-bold pt-1">धारा 3 : प्रवर्तनीयता (Enforceability)</p>
      <p>
        <strong>3.1</strong> यह प्रावधान एकतरफा रूप से अभ्यर्थी अथवा संस्थान द्वारा निरस्त नहीं किया
        जा सकेगा।
      </p>
      <p>
        <strong>3.2</strong> यह नियम एवं इसकी समस्त शर्तें अभ्यर्थी और संस्थान दोनों पर समान रूप से
        बाध्यकारी होंगी।
      </p>
      <p>
        <strong>3.3</strong> किसी भी प्रकार के विवाद की दशा में, यह नियम विधिक साक्ष्य (Legal
        Evidence) के रूप में न्यायालय/प्राधिकृत प्राधिकरण के समक्ष प्रवर्तनीय (Enforceable) होगा।
      </p>
    </div>

    {/* Page 85 */}
    <div className="space-y-1 pt-1.5 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">3. पाठ्यक्रम और संचालन</h4>
      <p>
        3.1. NVEA द्वारा संचालित समस्त पाठ्यक्रम/प्रोग्राम/सेवाएँ केवल <strong>ऑनलाइन मोड</strong>{' '}
        में संचालित होंगी।
      </p>
      <p>
        3.2. यह पूर्णतः स्वीकार किया गया है कि NVEA किसी भी परिस्थिति में{' '}
        <strong>ऑफ़लाइन कोचिंग/कक्षा संचालन हेतु बाध्य नहीं होगा।</strong>
      </p>
      <p>
        3.3. सभी शैक्षणिक गतिविधियाँ केवल <strong>शैक्षणिक एवं क्रिएटिव प्रयोजन</strong> के लिए हैं
        और किसी भी तरह के व्यवसायिक, सरकारी या शैक्षणिक बोर्ड के साथ वैधानिक संबंध स्थापित नहीं
        करतीं।
      </p>
    </div>

    {/* Page 86, 87, 88, 89 */}
    <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">4. फीस संरचना और रिफंड नीति</h4>
      <p>
        4.1. <strong>CLAP कोर शुल्क (Core Fee):</strong> केवल शेष अवधि/सत्र के अनुपातानुसार आंशिक
        वापसी योग्य। बैच/सत्र/सेमेस्टर के पूर्ण होने के उपरांत कोई भी वापसी नहीं होगी।
      </p>
      <p>
        4.2. <strong>CLAP मेंटेनेंस शुल्क:</strong> पूर्णतः Non-Refundable, संचालन और रखरखाव हेतु।
      </p>
      <p>
        4.3. <strong>CLAP ऐड-ऑन/कॉम्बो शुल्क:</strong> पूर्णतः Non-Refundable, अतिरिक्त/वैकल्पिक
        सेवाओं हेतु।
      </p>
      <p>
        4.4. <strong>नामांकन/प्रोसेसिंग शुल्क:</strong> एक बार देय; पूर्णतः Non-Refundable।
      </p>
      <p>
        4.5 मैं/हम, छात्र/अभिभावक, पूर्ण स्वतंत्र इच्छा तथा संपूर्ण विवेक से यह स्पष्ट, बिना-शर्त
        और बाध्यकारी रूप से स्वीकार/घोषणा करते है।/करती हूँ/करता हूँ। कि{' '}
        <strong>
          NAND VIDHYA EDUCATION ACADEMY (NVEA) सिर्फ (CLAP कोर शुल्क (Core Fee)
        </strong>{' '}
        ही नियमानुसार एवं शेष बची हुई अवधि के अनुसार रिफन्ड करता है। इसके अलावा किसी भी प्रकार का जमा
        किया शुल्क चाहे <strong>CLAP मेंटेनेंस शुल्क</strong> या फिर{' '}
        <strong>CLAP ऐड-ऑन/कॉम्बो शुल्क</strong> हो या फिर{' '}
        <strong>नामांकन/प्रोसेसिंग शुल्क</strong> हो नव्या कदापि रिफन्ड नहीं करता है। ना ही कानूनन
        नव्या को सिर्फ <strong>CLAP कोर शुल्क (Core Fee</strong> के अलावा जमा किए गए किसी उपरोक्त
        अतिरिक्त शुल्क के लिए बाध्य अथवा विवश किया जा सकता है।
      </p>
      <p>
        4.6. मैं/हम, छात्र/अभिभावक, <strong>पूर्ण स्वतंत्र इच्छा</strong> तथा{' '}
        <strong>संपूर्ण विवेक</strong> से यह स्पष्ट, बिना-शर्त और बाध्यकारी रूप से स्वीकार/घोषणा
        करते है।/करती हूँ/करता हूँ। कि <strong>NAND VIDHYA EDUCATION ACADEMY (NVEA)</strong> का
        एकमात्र वैध एवं आधिकारिक करंट बैंक खाता Union Bank of India, A/C No.:{' '}
        <strong>104321010000244</strong>, IFSC: <strong>UBIN0910431</strong> है और केवल इसी खाते में
        प्रत्यक्ष रूप से प्राप्त भुगतान को ही संस्थान अधिकारपूर्वक स्वीकार करेगा/करेगी।
      </p>

      <p>
        <strong>NVEA द्वारा दिए गए वैध भुगतान विकल्प (केवल-दो विकल्प):</strong> संस्थान स्पष्ट रूप से
        छात्रों/अभिभावकों को केवल निम्नलिखित दो वैध विकल्प प्रदान करता/करती है — और इनसे भिन्न किसी
        भी भुगतान-विधि/दावे को संस्थान मान्य नहीं करेगा:
      </p>
      <ol className="list-decimal list-inside space-y-1 pl-1">
        <li>
          <strong>नकद (Cash) — सीधे बैंक डिपॉज़िट:</strong> छात्र/अभिभावक नकद शुल्क केवल और केवल
          सीधे उपर्युक्त आधिकारिक बैंक खाते में जमा करायेंगे; इस प्रक्रिया में बैंक द्वारा जारी{' '}
          <strong>कैश-डिपॉज़िट-स्लिप</strong> पर भुगतानकर्ता (विद्यार्थी/अभिभावक) का स्पष्ट
          हस्ताक्षर अनिवार्य होगा; उक्त स्लिप की मूल प्रति बैंक से प्राप्त कराकर उसे तुरंत NVEA को
          सौंपा जाएगा; NVEA द्वारा स्लिप पर अधिकृत हस्ताक्षर एवं संस्थान की मुहर लगाकर उसकी
          हार्ड-कॉपी सुरक्षित रखी जाएगी। उपर्युक्त प्रक्रिया का पालन न होने पर उक्त नकद जमा{' '}
          <strong>पूर्णतः अमान्य एवं शून्य (void ab initio)</strong> होगा।
        </li>
        <li>
          <strong>डिजिटल/बैंकिंग/UPI — प्रत्यक्ष ट्रांसफर या आधिकारिक QR:</strong> भुगतान केवल और
          केवल उपर्युक्त आधिकारिक खाते में प्रत्यक्ष डिजिटल माध्यम (NEFT/RTGS/IMPS/Internet
          Banking/NetBanking) द्वारा या वही UPI-QR जो प्रत्यक्ष रूप से उक्त आधिकारिक करंट-अकाउंट से
          जुड़ा हो, उसके माध्यम से मान्य होगा; किसी भी अन्य UPI/वॉलेट/तीसरे-पक्ष के खाते या अनधिकृत
          QR को मान्यता नहीं दी जाएगी।
        </li>
      </ol>

      <p>
        <strong>स्पष्ट एवं अनिवार्य निर्देश (Non-Negotiable Instruction): NVEA कड़े शब्दों में निवेदन और अनिवार्य रूप से घोषित</strong>{' '}
        करता/करती है कि कभी भी कोई भी भुगतान NVEA के किसी भी स्थानीय/स्वामित्व-काउंटर पर सीधे जमा न
        कराएँ; सभी नकद जमा केवल बैंक के माध्यम से सीधे उपर्युक्त आधिकारिक करंट-अकाउंट में ही किए
        जाएँ। साथ ही, डिजिटल/UPI द्वारा किये जाने वाले सभी ट्रांसफर{' '}
        <strong>केवल एवं केवल</strong> उस स्वयं-नामांकनकर्ता (self-enroller) के बैंक खाते या उसके{' '}
        <strong>वास्तविक अभिभावक (real parents)</strong> के बैंक खाते से ही मान्य होंगे — किसी
        तीसरे-पक्ष खाते, किसी अन्य व्यक्ति के खाते अथवा अनधिकृत डिजिटल स्रोत से होने वाला कोई भी
        ट्रांसफर <strong>पूर्णतः अमान्य और शून्य</strong> माना जाएगा। किसी भी पक्ष द्वारा यह दावा
        किया जाना कि संस्थान ने उपर्युक्त विकल्प उपलब्ध नहीं कराए थे, स्पष्टतः निराधार और अस्वीकार्य
        होगा।
      </p>

      <p>
        <strong>मानवीय/प्रशासनिक त्रुटि:</strong> यदि किसी मानवीय भूल, प्रशासनिक चूक या तकनीकी
        कारणवश किसी छात्र का नामांकन रिकॉर्ड में दर्ज हो गया पर भुगतान उपर्युक्त आधिकारिक खाते में
        प्राप्त न हुआ (विशेषकर केवल अनियमित नकद जमा के कारण), तो ऐसा नामांकन{' '}
        <strong>कानूनी दृष्टि से शून्य, अमान्य और निर्विवाद रूप से गैर-मान्यता</strong> प्राप्त होगा।
      </p>

      <p>
        <strong>रिफंड नीति:</strong> रिफंड केवल उसी बैंक खाते में किया जाएगा जिससे मूल भुगतान हुआ
        हो; किसी भी तृतीय-पक्ष खाते/अनधिकृत खाते में रिफंड नहीं किया जाएगा। रिफंड हेतु प्रस्तुत सभी
        भुगतान-साक्ष्य (बैंक रसीद/UTR/Transaction ID/कैश-डिपॉज़िट-स्लिप) भारतीय साक्ष्य अधिनियम,
        1872 (Sec. 65-B) के अनुरूप निर्णायक, वैध और बाध्यकारी माने जाएँगे।
      </p>

      <p>
        <strong>उत्तरदायित्व एवं क्षतिपूर्ति:</strong> किसी भी अनधिकृत/त्रुटिपूर्ण/अनियमित भुगतान या
        नियमों के उल्लंघन के कारण NVEA को हुए किसी भी प्रकार के नुकसान, दावे, शुल्क, व्यय या कानूनी
        लागत की पूर्ण जिम्मेदारी केवल और केवल भुगतानकर्ता/विद्यार्थी/अभिभावक की होगी, और वे NVEA को
        तत्काल तथा पूर्ण रूप से क्षतिपूर्ति (indemnify) करने के लिए बाध्य होंगे।
      </p>

      <p>
        <strong>विवाद व अधिकार क्षेत्र:</strong> इस स्वीकृति-क्लॉज़ से सम्बंधित किसी भी विवाद,
        चुनौती या दावे का निपटारा केवल भारतीय कानूनों के अंतर्गत संबंधित न्यायालयों में किया जाएगा;
        इस स्वीकारोक्ति के किसी भी हिस्से को चुनौती देना या इसके निष्पादन को रोकने का प्रयत्न
        न्यायालय द्वारा अस्वीकार्य माना जाएगा।
      </p>

      <p>
        4.6. मैं पूर्णतः स्वीकार करता/करती हूँ कि इस फीस नीति एवं रिफंड नियम के विरुद्ध कोई भी दावा,
        आपत्ति, प्रतिवाद, वाद या कोर्ट में चुनौती{' '}
        <strong>ipso facto (स्वतः) अमान्य, अवैध एवं निरस्त (Null &amp; Void Ab Initio)</strong>{' '}
        होगी।
      </p>

      <p>
        4.7. इस शपथपत्र/डिस्क्लेमर को चुनौती देने का कोई भी प्रयास{' '}
        <strong>
          सिविल प्रोसीजर कोड, 1908, भारतीय साक्ष्य अधिनियम, 1872, भारतीय संविदा अधिनियम, 1872 एवं
          सभी प्रासंगिक कानूनों के तहत अस्वीकार्य (Non-Maintainable)
        </strong>{' '}
        होगा।
      </p>
    </div>

    {/* Page 90 */}
    <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">5. दायित्व और उत्तरदायित्व</h4>
      <p>
        5.1. मैं, नामांकित छात्र/अभिभावक, पूर्णतः सहमत हूँ कि NVEA द्वारा निर्धारित समस्त नियम,
        शर्तें, दिशा-निर्देश और प्रावधान अक्षरशः पालन योग्य हैं।
      </p>
      <p>
        5.2. किसी भी प्रकार की लापरवाही, कदाचार, अनुशासनहीनता, या नियम-उल्लंघन की स्थिति में सभी
        दायित्व मैं/हम पूर्ण रूप से स्वीकार करते हैं।
      </p>
      <p>
        5.3. NVEA, उसके निदेशक, प्रबंधन या कर्मचारी किसी भी प्रकार के सिविल/क्रिमिनल दावों हेतु
        उत्तरदायी नहीं होंगे।
      </p>
      <p>
        5.4. <strong>सुरक्षा एवं आकस्मिक/अप्रत्याशित घटनाओं के संबंध में दायित्व की छूट:</strong>{' '}
        मैं/हम, अभिभावक/प्रतिनिधि, स्पष्टतया स्वीकार/स्वीकार करते हैं कि NVEA, उसके निदेशकगण,
        प्रबंधन एवं कर्मचारी किसी भी छात्र/लर्नर को जानबूझकर शारीरिक या मानसिक दंड नहीं देते।
        तथापि, किसी भी कारणवश—जिसमें गलती, अनिच्छानुसार कार्यवाही, आकस्मिक घटना, गिरावट, चोट,
        दुर्घटना, अप्रत्याशित स्वास्थ्य घटना या किसी अन्य अप्रत्याशित कारण शामिल हैं—यदि छात्र/लर्नर
        को शारीरिक या मानसिक हानि, गंभीर चोट, दुर्घटना या मृत्यु होती है, तो मैं/हम पूरी तरह से समझते
        और स्वीकार करते हैं कि{' '}
        <strong>
          NVEA, उसके निदेशकगण, प्रबंधन एवं कर्मचारी इस स्थिति के लिए किसी भी प्रकार के सिविल या
          आपराधिक दायित्व के लिए उत्तरदायी नहीं होंगे।
        </strong>
      </p>
      <p>
        मैं/हम इस बात की भी पूर्ण जिम्मेदारी लेते हैं कि ऐसे किसी भी अप्रत्याशित घटना के कारण
        उत्पन्न होने वाले किसी भी विवाद, दावे, मुकदमे या कानूनी कार्रवाई से NVEA मुक्त रहेगा और
        मैं/हम इसके खिलाफ कोई कानूनी दावा या कार्यवाही नहीं करेंगे। यह समझौता संस्था की सुरक्षा और
        छात्रों की आकस्मिक घटनाओं के प्रति अनुचित दायित्व से NVEA को{' '}
        <strong>कानून द्वारा अनुमत अधिकतम सीमा तक मुक्त</strong> करता है।
      </p>
    </div>

    {/* Page 91 */}
    <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">6. विवाद निवारण एवं अधिकार क्षेत्र</h4>
      <p>
        6.1. किसी भी विवाद, दावा या फीस वापसी से जुड़ी चुनौती, प्रत्यक्ष अथवा परोक्ष रूप से, स्वतः{' '}
        <strong>अवैध, अमान्य और निरस्त (Null &amp; Void)</strong> होगी।
      </p>
      <p>
        6.2. यदि इसके बावजूद कोई न्यायिक कार्यवाही प्रारंभ होती है, तो{' '}
        <strong>
          सुनवाई एवं अधिकारक्षेत्र केवल किशनगढ़ शहर, (अजमेर जिला, राज्य राजस्थान) के सक्षम
          न्यायालयों
        </strong>{' '}
        के अधीन होगी।
      </p>

      <h4 className="font-bold text-sm text-[#0F2942] pt-1">7. संवैधानिक सुरक्षा</h4>
      <p>
        7.1. यह शपथपत्र भारतीय संविधान के अनुच्छेद 19(1)(g) (व्यवसाय करने की स्वतंत्रता) तथा
        अनुच्छेद 21 (जीवन एवं व्यक्तिगत स्वतंत्रता का अधिकार) के तहत{' '}
        <strong>संवैधानिक रूप से संरक्षित</strong> है।
      </p>
      <p>
        7.2. इस पर किसी भी प्रकार का आपत्ति, दावा या वाद मौलिक अधिकारों का हनन मानकर स्वतः{' '}
        <strong>अवैध, अमान्य और शून्य (Illegal, Null &amp; Void)</strong> होगा।
      </p>
    </div>

    {/* Page 92 */}
    <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
      <h4 className="font-bold text-sm text-[#0F2942]">8. अंतिम शपथ एवं कानूनी स्वीकृति</h4>
      <p>
        8.1. मैं उपरोक्त समस्त कथनों को पूर्णतः सत्य, सटीक और अपने ज्ञान एवं विश्वास के अनुसार
        स्वीकार करता/करती हूँ।
      </p>
      <p>
        8.2. यह शपथपत्र{' '}
        <strong>
          स्वेच्छा, बिना दबाव या प्रलोभन के, भारतीय शपथ अधिनियम, 1969 तथा भारतीय साक्ष्य अधिनियम,
          1872
        </strong>{' '}
        के तहत दिया गया है।
      </p>
      <p>
        8.3. इस शपथपत्र की डिजिटल/हस्तलिखित प्रति अपने स्वयं (शपथकर्ता) के आधिकारिक आधार कार्ड की
        फोटो प्रतिलिपि पर आधिकारिक हस्ताक्षर होने तथा उसे इस डिजिटल नामांकन फॉर्म के साथ शपथ को
        कानूनी मान्यता देते हुए इस गूगल फॉर्म पर अपलोड करते हुए{' '}
        <strong>कानूनी साक्ष्य और बाध्यकारी दस्तावेज़</strong> के रूप में प्रयुक्त होगी।
      </p>
    </div>
  </div>
);

interface Q170ConsentAffidavitProps {
  recordNumber?: string;
  applicantName?: string;
}

export const Q170ConsentAffidavitDescriptionBlock: React.FC<Q170ConsentAffidavitProps> = ({
  recordNumber = 'NVEA_RECORD',
  applicantName = 'Applicant',
}) => {
  const handleDownloadConsentCertificate = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8" />
  <title>NVEA Consent Certificate - ${recordNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: "Noto Sans Devanagari", Arial, sans-serif; color: #0F172A; line-height: 1.55; font-size: 13px; margin: 0; padding: 16px; }
    .sheet { border: 2px solid #0F2942; padding: 18px 22px; max-width: 780px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #0F2942; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { margin: 0; font-size: 18px; color: #0F2942; }
    .header h2 { margin: 4px 0; font-size: 14px; color: #1E3A8A; }
    .meta { display: flex; justify-content: space-between; background: #F8FAFC; border: 1px solid #CBD5E1; padding: 8px 12px; font-weight: bold; margin-bottom: 14px; font-size: 12.5px; }
    h3 { color: #0F2942; font-size: 14px; margin: 12px 0 6px; }
    h3.penal { color: #991B1B; }
    ol, ul { margin: 6px 0; padding-left: 22px; }
    li { margin-bottom: 4px; }
    .sign-box { margin-top: 28px; padding-top: 14px; border-top: 2px dashed #0F2942; display: flex; justify-content: space-between; gap: 20px; }
    .sign-col { width: 48%; border: 1px solid #94A3B8; padding: 12px; min-height: 95px; background: #FCFDFE; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1>NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या)</h1>
      <h2>अविचलनीय विधिक घोषणा एवं शपथपत्र (UNCONDITIONAL LEGAL DECLARATION &amp; CONSENT CERTIFICATE)</h2>
    </div>
    <div class="meta">
      <span>Record No: ${recordNumber}</span>
      <span>Applicant: ${applicantName}</span>
      <span>Date: ${new Date().toLocaleDateString('en-IN')}</span>
    </div>
    <p>मैं, अपने <em>आधार पहचान-पत्र</em> की विधिवत् प्रमाणित एवं स्वहस्ताक्षरित प्रति पर हस्ताक्षर अंकित कर, पूर्ण चेतना, विधिक समझ एवं स्वतंत्र इच्छा से यह घोषणा करता/करती हूँ कि:</p>
    <p>मैने <strong>NVEA (NAND VIDHYA EDUCATION ACADEMY/नव्या, नन्द विद्या शिक्षण संस्थान)</strong> के <em>आधिकारिक डिजिटल ऑनलाइन नामांकन प्रपत्र एवं शपथ पत्र</em> में निहित प्रत्येक कथन, प्रावधान एवं शर्त को पूर्ण रूप से पढ़ा, समझा एवं स्वेच्छा से स्वीकार किया है।</p>
    <h3>विधिक आधार एवं बाध्यता</h3>
    <ol>
      <li>यह घोषणा <strong>Indian Contract Act, 1872 (धारा 10, 11 एवं 73)</strong> के अधीन एक <em>विधिक रूप से वैध अनुबंध (Valid &amp; Enforceable Contract)</em> है, जो मुझे विधिक रूप से बाध्यकारी दायित्व में स्थापित करता है।</li>
      <li>इस घोषणा को मैं <strong>Indian Evidence Act, 1872 (धारा 17, 58, 65-B एवं 74)</strong> के अधीन <em>Admission, Estoppel एवं Electronic Record</em> के रूप में स्वीकार करता/करती हूँ, अतः यह किसी भी न्यायालय/प्राधिकरण में <em>पूर्णतः ग्राह्य साक्ष्य (Conclusive Evidence)</em> होगा।</li>
      <li>यह घोषणा <strong>Information Technology Act, 2000 (धारा 4, 5 एवं 85B)</strong> के अंतर्गत <em>डिजिटल हस्ताक्षरित एवं इलेक्ट्रॉनिक अभिलेख (Digitally Executed &amp; Authenticated Document)</em> मानी जाएगी, जो पूर्णतः वैधानिक एवं न्यायालयीन मान्यता प्राप्त है।</li>
      <li>मेरे द्वारा प्रस्तुत प्रत्येक कथन व विवरण <strong>Constitution of India, अनुच्छेद 20(3) एवं 21</strong> के अधीन <em>न्यायोचित प्रक्रिया (Due Process of Law)</em> का पालन करते हुए अभिप्रमाणित है, और मैं इस घोषणा की विधिक बाध्यता को स्वीकार करता/करती हूँ।</li>
    </ol>
    <h3 class="penal">दंडात्मक प्रावधान (Penal Consequences)</h3>
    <p>यदि इस घोषणा में उल्लिखित कोई कथन असत्य, मिथ्या अथवा कपटपूर्ण सिद्ध होता है, तो मैं विधिवत् यह स्वीकार करता/करती हूँ कि मेरे विरुद्ध <strong>भारतीय दंड संहिता (IPC, 1860)</strong> की धारा 191, 193, 415, 420, 463, 465, 471, 499 एवं 500 तथा <strong>Contempt of Court Act, 1971</strong> के अंतर्गत कठोर कार्यवाही की जा सकती है।</p>
    <h3>अविचलनीय विधिक प्रभाव (Irrevocable Legal Effect)</h3>
    <ol>
      <li>यह घोषणा <em>शत-प्रतिशत बाध्यकारी, अविचलनीय एवं न्यायालयीन साक्ष्य (100% Binding, Irrevocable &amp; Enforceable Legal Evidence)</em> है।</li>
      <li>इस घोषणा पर किसी भी प्रकार की आपत्ति, अपवाद या प्रतिवाद भविष्य में प्रस्तुत नहीं किया जा सकेगा, और यदि किया भी गया तो <strong>Estoppel Principle (Evidence Act, Section 115)</strong> के अधीन स्वतः अमान्य होगा।</li>
      <li>यह दस्तावेज़ भारत के अतिरिक्त किसी भी <em>अंतर्राष्ट्रीय न्यायाधिकरण (International Tribunal)</em> अथवा विदेशी विधिक मंच पर भी <em>Convention on Electronic Commerce (UNCITRAL Model Law)</em> के अनुरूप ग्राह्य माना जाएगा।</li>
    </ol>
    <div class="sign-box">
      <div class="sign-col">
        <strong>शपथकर्ता / अभिभावक के हस्ताक्षर (हार्ड फोटो कॉपी पर):</strong><br/><br/><br/>
        नाम एवं दिनांक: ____________________________
      </div>
      <div class="sign-col">
        <strong>प्रवेशार्थी (Applicant) के हस्ताक्षर एवं आधार संख्या:</strong><br/><br/><br/>
        UID / दिनांक: ____________________________
      </div>
    </div>
  </div>
</body>
</html>`;
    const minifiedHtml = htmlContent
      .replace(/>\s+([<])/g, '>$1')
      .replace(/([>])\s+</g, '$1<')
      .trim();
    const blob = new Blob([minifiedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NVEA_Consent_Certificate_${recordNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="legal-block-print bg-[#FFFBEB]/80 border border-amber-300 p-3 my-1.5 text-xs text-slate-900 font-hindi space-y-1.5 leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-amber-200">
        <p className="font-bold text-[#0F2942]">
          अविचलनीय विधिक घोषणा एवं शपथपत्र (UNCONDITIONAL LEGAL DECLARATION &amp; AFFIDAVIT)
        </p>
        <button
          type="button"
          onClick={handleDownloadConsentCertificate}
          className="no-print inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer transition-colors"
          title="Download Consent Certificate to sign and upload back in Point 170"
        >
          <span>Download Consent Certificate</span>
        </button>
      </div>
      <p>
        मैं, अपने <em>आधार पहचान-पत्र</em> की विधिवत् प्रमाणित एवं स्वहस्ताक्षरित प्रति पर हस्ताक्षर
        अंकित कर, पूर्ण चेतना, विधिक समझ एवं स्वतंत्र इच्छा से यह घोषणा करता/करती हूँ कि:
      </p>
      <p>
        मैने{' '}
        <strong>
          NVEA (NAND VIDHYA EDUCATION ACADEMY/नव्या, नन्द विद्या शिक्षण संस्थान)
        </strong>{' '}
        के <em>आधिकारिक डिजिटल ऑनलाइन नामांकन प्रपत्र एवं शपथ पत्र</em> में निहित प्रत्येक कथन,
        प्रावधान एवं शर्त को पूर्ण रूप से पढ़ा, समझा एवं स्वेच्छा से स्वीकार किया है।
      </p>

      <p className="font-bold text-[#0F2942] pt-1">विधिक आधार एवं बाध्यता</p>
      <ol className="list-decimal list-inside space-y-1 pl-1">
        <li>
          यह घोषणा <strong>Indian Contract Act, 1872 (धारा 10, 11 एवं 73)</strong> के अधीन एक{' '}
          <em>विधिक रूप से वैध अनुबंध (Valid &amp; Enforceable Contract)</em> है, जो मुझे विधिक रूप से
          बाध्यकारी दायित्व में स्थापित करता है।
        </li>
        <li>
          इस घोषणा को मैं <strong>Indian Evidence Act, 1872 (धारा 17, 58, 65-B एवं 74)</strong> के
          अधीन <em>Admission, Estoppel एवं Electronic Record</em> के रूप में स्वीकार करता/करती हूँ,
          अतः यह किसी भी न्यायालय/प्राधिकरण में{' '}
          <em>पूर्णतः ग्राह्य साक्ष्य (Conclusive Evidence)</em> होगा।
        </li>
        <li>
          यह घोषणा <strong>Information Technology Act, 2000 (धारा 4, 5 एवं 85B)</strong> के अंतर्गत{' '}
          <em>
            डिजिटल हस्ताक्षरित एवं इलेक्ट्रॉनिक अभिलेख (Digitally Executed &amp; Authenticated
            Document)
          </em>{' '}
          मानी जाएगी, जो पूर्णतः वैधानिक एवं न्यायालयीन मान्यता प्राप्त है।
        </li>
        <li>
          मेरे द्वारा प्रस्तुत प्रत्येक कथन व विवरण{' '}
          <strong>Constitution of India, अनुच्छेद 20(3) एवं 21</strong> के अधीन{' '}
          <em>न्यायोचित प्रक्रिया (Due Process of Law)</em> का पालन करते हुए अभिप्रमाणित है, और मैं इस
          घोषणा की विधिक बाध्यता को स्वीकार करता/करती हूँ।
        </li>
      </ol>

      <p className="font-bold text-[#991B1B] pt-1">दंडात्मक प्रावधान (Penal Consequences)</p>
      <p>
        यदि इस घोषणा में उल्लिखित कोई कथन असत्य, मिथ्या अथवा कपटपूर्ण सिद्ध होता है, तो मैं विधिवत् यह
        स्वीकार करता/करती हूँ कि मेरे विरुद्ध <strong>भारतीय दंड संहिता (IPC, 1860)</strong> की
        निम्नलिखित धाराओं के अंतर्गत कठोर कार्यवाही की जा सकती है:
      </p>
      <ul className="list-disc list-inside pl-2 space-y-0.5">
        <li>
          <em>धारा 191 एवं 193</em> — झूठा साक्ष्य एवं शपथपूर्वक झूठा बयान।
        </li>
        <li>
          <em>धारा 415 एवं 420</em> — छल, धोखाधड़ी एवं कपटपूर्ण आचरण।
        </li>
        <li>
          <em>धारा 463, 465 एवं 471</em> — कूटरचना एवं कूट दस्तावेज़ का प्रयोग।
        </li>
        <li>
          <em>धारा 499 एवं 500</em> — मानहानि (Defamation) यदि झूठे आरोप/बयान के कारण संस्था की
          प्रतिष्ठा को क्षति पहुँचती है।
        </li>
      </ul>
      <p>
        साथ ही, यह घोषणा <strong>Contempt of Court Act, 1971</strong> के अधीन भी लागू होगी, जिससे किसी
        भी न्यायालय के समक्ष असत्य या भ्रामक जानकारी देने पर अवमानना की कार्यवाही की जा सकेगी।
      </p>

      <p className="font-bold text-[#0F2942] pt-1">
        अविचलनीय विधिक प्रभाव (Irrevocable Legal Effect)
      </p>
      <ol className="list-decimal list-inside space-y-1 pl-1">
        <li>
          यह घोषणा{' '}
          <em>
            शत-प्रतिशत बाध्यकारी, अविचलनीय एवं न्यायालयीन साक्ष्य (100% Binding, Irrevocable &amp;
            Enforceable Legal Evidence)
          </em>{' '}
          है।
        </li>
        <li>
          इस घोषणा पर किसी भी प्रकार की आपत्ति, अपवाद या प्रतिवाद भविष्य में प्रस्तुत नहीं किया जा
          सकेगा, और यदि किया भी गया तो{' '}
          <strong>Estoppel Principle (Evidence Act, Section 115)</strong> के अधीन स्वतः अमान्य होगा।
        </li>
        <li>
          यह दस्तावेज़ भारत के अतिरिक्त किसी भी{' '}
          <em>अंतर्राष्ट्रीय न्यायाधिकरण (International Tribunal)</em> अथवा विदेशी विधिक मंच पर भी{' '}
          <em>Convention on Electronic Commerce (UNCITRAL Model Law)</em> के अनुरूप ग्राह्य माना
          जाएगा।
        </li>
      </ol>
    </div>
  );
};
