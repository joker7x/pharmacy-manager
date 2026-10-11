# بحث تكامل طابعة USB مباشر

## النتيجة الأولية
المكتبة `react-native-usb-serial` توضح دعم Android فقط، مع اعتماد Android USB Host وعدم دعم iOS أو الويب. يلزم التحقق من أن الطابعة تظهر كجهاز serial مدعوم قبل اعتمادها النهائي.

المكتبة `react-native-serial-transport` بإصدار ظاهر 1.1.6 (آخر commit في مايو 2026) توفر USB serial على Android، وتذكر دعم CP210x وCH340 وFTDI وPL2303، كما توفر Expo config plugin وتضيف صلاحيات USB وdevice filter عند إعادة بناء التطبيق. هذا يجعلها مسارًا مناسبًا كبداية، لكن لا يثبت وحده أن XP-233B تعمل عبر USB serial؛ يجب اختبار Vendor/Product Interface الفعلي للطابعة على جهاز Android.

## قيود يجب توضيحها
الاتصال المباشر يحتاج Expo Dev Client أو بناء Android جديدًا، وليس Expo Go أو معاينة الويب. الإذن يُطلب عند اكتشاف جهاز USB، والطباعة تحتاج إرسال bytes خام وفق ESC/POS. لا يمكن اعتماد الاختبار النهائي دون جهاز Android فعلي وكابل OTG والطابعة.

## المصادر
- https://github.com/DeveloperRejaul/react-native-usb-serial
- https://github.com/luk3skyw4lker/react-native-serial-transport

## مواصفات الطابعة
صفحة Xprinter الرسمية تذكر أن XP-233B تتوفر بواجهة `USB` أو `USB + Bluetooth`، وتدعم لفائف الورق الحراري وورق الملصقات. لم تعرض الصفحة الرسمية VID/PID ثابتًا للطراز، لذلك لا تم تقييد device filter بمعرّف مخمّن؛ التطبيق يكتشف الأجهزة التي تعرضها طبقة USB serial، ويجب اختبار الطابعة الفعلية لأن بعض نسخ الطابعة قد تظهر كواجهة USB مختلفة.

- https://www.xprintertech.com/xp-233b-1

## مقارنة مسار USB printer class
مكتبة `react-native-printer-usb` تعرض API مخصصًا لطابعات USB الحرارية على Android، وتوفر `sendRawData` لأوامر ESC/POS، إضافة إلى طباعة النص والباركود والصور. هذا المسار أقرب لطابعة XP-233B من مكتبة serial التي تركز على شرائح CP210x/CH340/FTDI/PL2303، لأن طابعة USB قد تظهر كـ USB printer class أو bulk endpoint وليست serial adapter. يلزم اختبار الإصدار على الجهاز الفعلي قبل الاعتماد النهائي.

صفحة Xprinter الرسمية تؤكد أن XP-233B تأتي بواجهة USB أو USB+Bluetooth وتدعم الورق الحراري وورق الملصقات، لكنها لا تنشر VID/PID ثابتًا في الصفحة التي تمت مراجعتها؛ لذلك لا ينبغي تخمين device filter.

- https://github.com/DouglasFroes/react-native-printer-usb
- https://www.xprintertech.com/xp-233b-1
