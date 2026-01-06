import { Button } from "@/components/ui/button";
import { useTranslation, Language } from "@/lib/i18n";
import { Globe } from "lucide-react";

const LanguageToggle = () => {
  const { language, setLanguage } = useTranslation();

  const toggleLanguage = () => {
    const newLang: Language = language === 'vi' ? 'en' : 'vi';
    setLanguage(newLang);
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 font-medium"
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{language}</span>
    </Button>
  );
};

export default LanguageToggle;
