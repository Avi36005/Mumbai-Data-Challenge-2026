/* UI text in English, Hindi and Marathi. Hindi and Marathi are drafts: a native speaker should review them before wide sharing. */
window.I18N = {
en: {
  upto: 'up to {v} if smoke lingers', expPeak: 'Worst moment: {t}, when {p} lakh people and {s} lakh school students could be in Moderate or worse air if Diwali smoke lingers.', show: 'Show it',
  skip: 'Skip to planning', where: 'Where are you?', pickArea: 'Pick your area', locate: 'Use my location',
  locating: 'Finding you…', locFound: 'Nearest ward: {w}', locFar: 'You seem to be outside Mumbai, so we picked the nearest ward: {w}', locErr: 'Could not get your location. Pick your area from the list.',
  cigNote: 'Breathing this air all day is like smoking this many cigarettes (Berkeley Earth rule: 22 µg/m³ over a day ≈ 1 cigarette).',
  worstNote: 'Worst hour of the day here', bestNote: 'Cleanest hour of the day here', cigs: '{n} cigarettes',
  linger: 'If Diwali smoke lingers: {v}', lingerSame: 'Diwali smoke makes little difference at this hour',
  planH: 'Plan my day', planSub: 'Tell us what you are doing. We find the cleanest time for it.',
  mapH: 'The whole city, hour by hour', mapSub: "Each of Mumbai's 24 wards, coloured by expected PM2.5. Tap a ward to choose it. Move the slider above to change the hour.",
  people: 'people', students: 'school students', expH: 'At {t}: in Moderate or worse air', expNone: 'At {t}, every ward is Satisfactory or better.',
  expNote: 'Population: BMC ward figures. Students: UDISE+ 2024-25 enrolment in schools in those wards.',
  shareH: 'Send it to the family group', shareSub: "One picture with tomorrow's air for your area, in your language. Ready for WhatsApp.", share: 'Share picture', download: 'Download',
  trustH: 'Why trust this?', evidence: 'See the full evidence: model accuracy, Diwali patterns, weather, sensor health →',
  foot: 'Made by team Kryptonite for the Google Mumbai Data Challenge 2026. Forecasts are estimates, not medical advice.',
  best: 'Best time', avoid: 'Avoid', expected: 'expected', go: 'Go at {t}', between: '{a}–{b}',
  cat: ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very poor', 'Severe'],
  acts: { walk: 'Morning or evening walk', run: 'Running or exercise', kids: 'Kids playing outside', commute: 'Commute', elder: 'Elderly or heart / lung condition', work: 'Working outdoors all day' },
  adv: {
    ok: 'Air is fine for this. Enjoy it.',
    sens_mod: 'For children, older people and anyone with asthma or a heart condition: keep it short and easy.',
    mod: 'Fine for most people. If you cough or feel short of breath, slow down.',
    poor: 'Keep it short and light. People with asthma, heart disease, older people and children should stay indoors if they can.',
    vpoor: 'Avoid this outdoors if you can. If you must go, wear a well-fitting N95 mask.'
  },
  workNote: 'Over the working day the air averages {v} ({c}). Take breaks indoors around {t}.',
  trust: [
    ['4 stations forecast', 'Our competition model (LightGBM + NOAA GFS weather) forecasts the four official stations.'],
    ['{n} more stations estimated', 'A second model learned how every other Mumbai station moves with those four, from 2024 data.'],
    ['{p}% less error', 'than simply averaging the nearest stations, in a hold-out test ({a} vs {b} µg/m³).'],
    ['Checked on 2026 too', 'On 1-16 Oct 2026 at {s} stations: {a} vs {b} µg/m³ for the simple average.']
  ],
  sources: 'Data: Zindi challenge package (Train, AdditionalHistory); NOAA GFS; BMC ward boundaries and population; UDISE+ 2024-25 schools (all via ClimateVerse).',
  days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  cardTitle: 'Air in {w}', cardBest: 'Best time to go out', cardAvoid: 'Avoid', cardCig: '≈ {n} cigarettes', cardFoot: 'AirPulse Mumbai · forecast for {d}'
},
hi: {
  upto: 'धुआँ रुके तो {v} तक', expPeak: 'सबसे खराब समय: {t}, जब दिवाली का धुआँ रुके तो {p} लाख लोग और {s} लाख स्कूली छात्र मध्यम या खराब हवा में हो सकते हैं।', show: 'दिखाएँ',
  skip: 'योजना पर जाएँ', where: 'आप कहाँ हैं?', pickArea: 'अपना इलाका चुनें', locate: 'मेरी लोकेशन लें',
  locating: 'आपको ढूँढ रहे हैं…', locFound: 'सबसे पास का वार्ड: {w}', locFar: 'आप मुंबई के बाहर लगते हैं, इसलिए सबसे पास का वार्ड चुना: {w}', locErr: 'लोकेशन नहीं मिली। सूची से अपना इलाका चुनें।',
  cigNote: 'पूरे दिन यह हवा साँस में लेना इतनी सिगरेट पीने जैसा है (बर्कले अर्थ नियम: दिन भर 22 µg/m³ ≈ 1 सिगरेट)।',
  worstNote: 'यहाँ दिन का सबसे खराब समय', bestNote: 'यहाँ दिन का सबसे साफ़ समय', cigs: '{n} सिगरेट',
  linger: 'अगर दिवाली का धुआँ रुका रहे: {v}', lingerSame: 'इस समय दिवाली के धुएँ से ज़्यादा फ़र्क नहीं',
  planH: 'मेरा दिन प्लान करें', planSub: 'बताइए आप क्या करने वाले हैं। हम उसके लिए सबसे साफ़ हवा का समय बताएँगे।',
  mapH: 'पूरा शहर, हर घंटे', mapSub: 'मुंबई के 24 वार्ड, अनुमानित PM2.5 के रंग में। वार्ड चुनने के लिए उस पर टैप करें। समय बदलने के लिए ऊपर का स्लाइडर खिसकाएँ।',
  people: 'लोग', students: 'स्कूली छात्र', expH: '{t} पर: मध्यम या उससे खराब हवा में', expNone: '{t} पर हर वार्ड में हवा संतोषजनक या बेहतर है।',
  expNote: 'आबादी: BMC वार्ड के आँकड़े। छात्र: उन वार्डों के स्कूलों में UDISE+ 2024-25 नामांकन।',
  shareH: 'परिवार ग्रुप में भेजें', shareSub: 'आपके इलाके की कल की हवा, आपकी भाषा में, एक तस्वीर में। WhatsApp के लिए तैयार।', share: 'तस्वीर भेजें', download: 'डाउनलोड',
  trustH: 'इस पर भरोसा क्यों करें?', evidence: 'पूरा सबूत देखें: मॉडल की सटीकता, दिवाली के पैटर्न, मौसम, सेंसर की हालत →',
  foot: 'टीम क्रिप्टोनाइट द्वारा Google Mumbai Data Challenge 2026 के लिए बनाया गया। पूर्वानुमान अनुमान हैं, चिकित्सा सलाह नहीं।',
  best: 'सबसे अच्छा समय', avoid: 'इस समय से बचें', expected: 'अनुमानित', go: '{t} पर जाएँ', between: '{a}–{b}',
  cat: ['अच्छी', 'संतोषजनक', 'मध्यम', 'खराब', 'बहुत खराब', 'गंभीर'],
  acts: { walk: 'सुबह या शाम की सैर', run: 'दौड़ या कसरत', kids: 'बच्चों का बाहर खेलना', commute: 'आना-जाना', elder: 'बुज़ुर्ग या दिल / फेफड़ों की बीमारी', work: 'पूरे दिन बाहर काम' },
  adv: {
    ok: 'इसके लिए हवा ठीक है।',
    sens_mod: 'बच्चे, बुज़ुर्ग और अस्थमा या दिल के मरीज़: कम समय और हल्का रखें।',
    mod: 'ज़्यादातर लोगों के लिए ठीक। खाँसी या साँस फूले तो धीमे हो जाएँ।',
    poor: 'कम समय और हल्का रखें। अस्थमा, दिल के मरीज़, बुज़ुर्ग और बच्चे हो सके तो घर में रहें।',
    vpoor: 'हो सके तो बाहर यह न करें। जाना ज़रूरी हो तो अच्छी तरह फ़िट N95 मास्क पहनें।'
  },
  workNote: 'काम के घंटों में औसत हवा {v} ({c})। {t} के आसपास घर के अंदर ब्रेक लें।',
  trust: [
    ['4 स्टेशनों का पूर्वानुमान', 'हमारा प्रतियोगिता मॉडल (LightGBM + NOAA GFS मौसम) चार आधिकारिक स्टेशनों का पूर्वानुमान करता है।'],
    ['{n} और स्टेशनों का अनुमान', 'दूसरे मॉडल ने 2024 के डेटा से सीखा कि मुंबई के बाकी स्टेशन इन चारों के साथ कैसे बदलते हैं।'],
    ['{p}% कम गलती', 'पास के स्टेशनों का सीधा औसत लेने की तुलना में, होल्ड-आउट जाँच में ({a} बनाम {b} µg/m³)।'],
    ['2026 में भी जाँचा', '1-16 अक्टूबर 2026, {s} स्टेशन: {a} बनाम सीधे औसत के {b} µg/m³।']
  ],
  sources: 'डेटा: Zindi चैलेंज पैकेज; NOAA GFS; BMC वार्ड सीमाएँ और आबादी; UDISE+ 2024-25 स्कूल (सभी ClimateVerse से)।',
  days: ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'], months: ['जन','फ़र','मार्च','अप्रै','मई','जून','जुला','अग','सित','अक्टू','नव','दिस'],
  cardTitle: '{w} की हवा', cardBest: 'बाहर जाने का सबसे अच्छा समय', cardAvoid: 'इस समय से बचें', cardCig: '≈ {n} सिगरेट', cardFoot: 'AirPulse Mumbai · {d} का पूर्वानुमान'
},
mr: {
  upto: 'धूर टिकल्यास {v} पर्यंत', expPeak: 'सर्वात वाईट वेळ: {t}, दिवाळीचा धूर टिकल्यास {p} लाख लोक आणि {s} लाख शालेय विद्यार्थी मध्यम किंवा वाईट हवेत असू शकतात.', show: 'दाखवा',
  skip: 'नियोजनाकडे जा', where: 'तुम्ही कुठे आहात?', pickArea: 'तुमचा भाग निवडा', locate: 'माझे ठिकाण वापरा',
  locating: 'तुम्हाला शोधत आहोत…', locFound: 'सर्वात जवळचा वॉर्ड: {w}', locFar: 'तुम्ही मुंबईबाहेर दिसता, म्हणून सर्वात जवळचा वॉर्ड निवडला: {w}', locErr: 'ठिकाण मिळाले नाही. यादीतून तुमचा भाग निवडा.',
  cigNote: 'दिवसभर ही हवा श्वासात घेणे म्हणजे इतक्या सिगारेट ओढण्यासारखे (बर्कले अर्थ नियम: दिवसभर 22 µg/m³ ≈ 1 सिगारेट).',
  worstNote: 'इथे दिवसातील सर्वात वाईट वेळ', bestNote: 'इथे दिवसातील सर्वात स्वच्छ वेळ', cigs: '{n} सिगारेट',
  linger: 'दिवाळीचा धूर टिकून राहिल्यास: {v}', lingerSame: 'या वेळी दिवाळीच्या धुराचा फारसा फरक नाही',
  planH: 'माझा दिवस ठरवा', planSub: 'तुम्ही काय करणार आहात ते सांगा. त्यासाठी सर्वात स्वच्छ हवेची वेळ आम्ही सांगू.',
  mapH: 'संपूर्ण शहर, तासागणिक', mapSub: 'मुंबईचे 24 वॉर्ड, अपेक्षित PM2.5 नुसार रंगवलेले. वॉर्ड निवडण्यासाठी त्यावर टॅप करा. वेळ बदलण्यासाठी वरचा स्लायडर सरकवा.',
  people: 'लोक', students: 'शालेय विद्यार्थी', expH: '{t} वाजता: मध्यम किंवा त्याहून वाईट हवेत', expNone: '{t} वाजता प्रत्येक वॉर्डात हवा समाधानकारक किंवा चांगली आहे.',
  expNote: 'लोकसंख्या: BMC वॉर्डचे आकडे. विद्यार्थी: त्या वॉर्डांतील शाळांमधील UDISE+ 2024-25 नोंदणी.',
  shareH: 'कुटुंबाच्या ग्रुपवर पाठवा', shareSub: 'तुमच्या भागाची उद्याची हवा, तुमच्या भाषेत, एका चित्रात. WhatsApp साठी तयार.', share: 'चित्र पाठवा', download: 'डाउनलोड',
  trustH: 'यावर विश्वास का ठेवावा?', evidence: 'संपूर्ण पुरावा पाहा: मॉडेलची अचूकता, दिवाळीचे नमुने, हवामान, सेन्सरची स्थिती →',
  foot: 'टीम क्रिप्टोनाइटने Google Mumbai Data Challenge 2026 साठी बनवले. अंदाज हे अंदाजच आहेत, वैद्यकीय सल्ला नाही.',
  best: 'सर्वोत्तम वेळ', avoid: 'ही वेळ टाळा', expected: 'अपेक्षित', go: '{t} वाजता जा', between: '{a}–{b}',
  cat: ['चांगली', 'समाधानकारक', 'मध्यम', 'वाईट', 'खूप वाईट', 'गंभीर'],
  acts: { walk: 'सकाळी किंवा संध्याकाळी फिरणे', run: 'धावणे किंवा व्यायाम', kids: 'मुलांचे बाहेर खेळणे', commute: 'प्रवास', elder: 'ज्येष्ठ किंवा हृदय / फुफ्फुसाचा आजार', work: 'दिवसभर बाहेर काम' },
  adv: {
    ok: 'यासाठी हवा चांगली आहे.',
    sens_mod: 'मुले, ज्येष्ठ आणि दमा किंवा हृदयविकार असलेल्यांनी: कमी वेळ आणि हलके ठेवा.',
    mod: 'बहुतेकांसाठी ठीक. खोकला आला किंवा दम लागला तर हळू करा.',
    poor: 'कमी वेळ आणि हलके ठेवा. दमा, हृदयविकार असलेले, ज्येष्ठ आणि मुले शक्य असल्यास घरातच राहा.',
    vpoor: 'शक्य असल्यास हे बाहेर टाळा. जावेच लागले तर नीट बसणारा N95 मास्क वापरा.'
  },
  workNote: 'कामाच्या वेळेत सरासरी हवा {v} ({c}). {t} च्या आसपास घरात विश्रांती घ्या.',
  trust: [
    ['4 स्टेशनांचा अंदाज', 'आमचे स्पर्धा मॉडेल (LightGBM + NOAA GFS हवामान) चार अधिकृत स्टेशनांचा अंदाज देते.'],
    ['आणखी {n} स्टेशनांचा अंदाज', 'दुसऱ्या मॉडेलने 2024 च्या डेटावरून शिकले की मुंबईतील इतर स्टेशने या चारांबरोबर कशी बदलतात.'],
    ['{p}% कमी चूक', 'जवळच्या स्टेशनांची साधी सरासरी घेण्यापेक्षा, होल्ड-आउट तपासणीत ({a} विरुद्ध {b} µg/m³).'],
    ['2026 मध्येही तपासले', '1-16 ऑक्टोबर 2026, {s} स्टेशने: {a} विरुद्ध साध्या सरासरीचे {b} µg/m³.']
  ],
  sources: 'डेटा: Zindi चॅलेंज पॅकेज; NOAA GFS; BMC वॉर्ड सीमा आणि लोकसंख्या; UDISE+ 2024-25 शाळा (सर्व ClimateVerse मधून).',
  days: ['रवि','सोम','मंगळ','बुध','गुरु','शुक्र','शनि'], months: ['जाने','फेब्रु','मार्च','एप्रि','मे','जून','जुलै','ऑग','सप्टें','ऑक्टो','नोव्हें','डिसें'],
  cardTitle: '{w} मधील हवा', cardBest: 'बाहेर जाण्याची सर्वोत्तम वेळ', cardAvoid: 'ही वेळ टाळा', cardCig: '≈ {n} सिगारेट', cardFoot: 'AirPulse Mumbai · {d} चा अंदाज'
}
};
