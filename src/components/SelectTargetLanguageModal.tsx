import React, { useState } from 'react';
import { Globe, Check, Settings2, X, ArrowLeft, Plus } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES_CATALOG,
  getUserLearningLanguages,
  setUserLearningLanguages,
  setVideoTargetLang,
} from '../utils/appSettings';

interface SelectTargetLanguageModalProps {
  isOpen: boolean;
  videoId: string;
  onClose: () => void;
  onSelectLanguage: (langCode: string) => void;
  currentSelectedLang?: string | null;
}

export const SelectTargetLanguageModal: React.FC<SelectTargetLanguageModalProps> = ({
  isOpen,
  videoId,
  onClose,
  onSelectLanguage,
  currentSelectedLang,
}) => {
  const [learningLanguages, setLearningLanguages] = useState<string[]>(() =>
    getUserLearningLanguages()
  );
  const [isManagingList, setIsManagingList] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (code: string) => {
    setVideoTargetLang(videoId, code);
    onSelectLanguage(code);
    onClose();
  };

  const handleToggleLanguageInList = (code: string) => {
    let updated: string[];
    if (learningLanguages.includes(code)) {
      if (learningLanguages.length <= 1) return; // keep at least one
      updated = learningLanguages.filter((l) => l !== code);
    } else {
      updated = [...learningLanguages, code];
    }
    setLearningLanguages(updated);
    setUserLearningLanguages(updated);
  };

  return (
    <div
      id="select-target-language-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-lang-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl p-5 text-neutral-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="target-lang-modal-title"
                className="text-base font-semibold text-white tracking-tight"
              >
                {isManagingList ? 'Learning Languages' : 'Target Language'}
              </h2>
              <p className="text-xs text-neutral-400">
                {isManagingList
                  ? 'Choose languages you want to learn'
                  : 'Select translation for this video'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-target-language-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isManagingList ? (
          <div className="py-4 space-y-2 flex-1 overflow-y-auto">
            <div className="text-xs text-neutral-400 font-medium px-1 mb-2">
              Your Defined Learning Languages:
            </div>
            <div className="grid grid-cols-1 gap-2">
              {learningLanguages.map((code) => {
                const lang =
                  SUPPORTED_LANGUAGES_CATALOG.find((l) => l.code === code) || {
                    code,
                    name: code.toUpperCase(),
                  };
                const isSelected = currentSelectedLang === code;
                return (
                  <button
                    key={code}
                    id={`target-lang-option-${code}`}
                    type="button"
                    onClick={() => handleSelect(code)}
                    className={`w-full min-h-[48px] px-4 py-3 rounded-xl border flex items-center justify-between text-left transition font-medium text-sm ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/60 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center font-mono text-xs text-indigo-300 uppercase">
                        {code}
                      </span>
                      <span>{lang.name}</span>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-400" />}
                  </button>
                );
              })}
            </div>

            {/* Manage languages button */}
            <div className="pt-3">
              <button
                type="button"
                id="manage-learning-languages-btn"
                onClick={() => setIsManagingList(true)}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-300 hover:text-white text-xs flex items-center justify-center gap-2 transition"
              >
                <Settings2 className="w-4 h-4 text-neutral-400" />
                <span>Customize Learning Languages List</span>
              </button>
            </div>
          </div>
        ) : (
          /* Manage Defined Languages View */
          <div className="py-4 space-y-3 flex-1 overflow-y-auto">
            <div className="text-xs text-neutral-400 px-1">
              Select all languages you are interested in learning:
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {SUPPORTED_LANGUAGES_CATALOG.map((lang) => {
                const isChecked = learningLanguages.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleToggleLanguageInList(lang.code)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between text-left transition text-xs ${
                      isChecked
                        ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
                        : 'bg-neutral-800/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono uppercase text-[11px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
                        {lang.code}
                      </span>
                      <span className="font-medium">{lang.name}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-neutral-600 bg-neutral-900'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              id="finish-managing-languages-btn"
              onClick={() => setIsManagingList(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Selection</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
