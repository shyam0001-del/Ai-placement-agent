import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Code2,
  Target,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
} from 'lucide-react';

export default function ProfileView({
  profile,
  activeUserId,
  onSave,
  isLoading,
  error,
  successMessage,
  onBackToChat,
}) {
  const [formData, setFormData] = useState(() => ({
    name: profile?.name || '',
    email: profile?.email || '',
    degree: profile?.degree || '',
    specialization: profile?.specialization || '',
    experienceLevel: profile?.experienceLevel || 'Student',
    targetRole: profile?.targetRole || 'Data Scientist',
    leetcodeSolved: profile?.leetcodeSolved || 0,
    skills: Array.isArray(profile?.skills) ? [...profile.skills] : [],
    targetCompanies: Array.isArray(profile?.targetCompanies) ? [...profile.targetCompanies] : [],
    weakAreas: Array.isArray(profile?.weakAreas) ? [...profile.weakAreas] : [],
  }));

  const lastSyncedId = useRef(profile?.id || '');

  const [newCompany, setNewCompany] = useState('');
  const [newWeakArea, setNewWeakArea] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('intermediate');

  useEffect(() => {
    if (profile && profile.id && profile.id !== lastSyncedId.current) {
      lastSyncedId.current = profile.id;
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        degree: profile.degree || '',
        specialization: profile.specialization || '',
        experienceLevel: profile.experienceLevel || 'Student',
        targetRole: profile.targetRole || 'Data Scientist',
        leetcodeSolved: profile.leetcodeSolved || 0,
        skills: Array.isArray(profile.skills) ? [...profile.skills] : [],
        targetCompanies: Array.isArray(profile.targetCompanies) ? [...profile.targetCompanies] : [],
        weakAreas: Array.isArray(profile.weakAreas) ? [...profile.weakAreas] : [],
      });
    }
  }, [profile]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: newSkillName.trim(), level: newSkillLevel }],
    }));
    setNewSkillName('');
    setNewSkillLevel('intermediate');
  };

  const handleRemoveSkill = (index) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const handleAddCompany = () => {
    if (!newCompany.trim()) return;
    if (!formData.targetCompanies.includes(newCompany.trim())) {
      setFormData((prev) => ({
        ...prev,
        targetCompanies: [...prev.targetCompanies, newCompany.trim()],
      }));
    }
    setNewCompany('');
  };

  const handleRemoveCompany = (company) => {
    setFormData((prev) => ({
      ...prev,
      targetCompanies: prev.targetCompanies.filter((c) => c !== company),
    }));
  };

  const handleAddWeakArea = () => {
    if (!newWeakArea.trim()) return;
    if (!formData.weakAreas.includes(newWeakArea.trim())) {
      setFormData((prev) => ({
        ...prev,
        weakAreas: [...prev.weakAreas, newWeakArea.trim()],
      }));
    }
    setNewWeakArea('');
  };

  const handleRemoveWeakArea = (area) => {
    setFormData((prev) => ({
      ...prev,
      weakAreas: prev.weakAreas.filter((a) => a !== area),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 max-w-4xl mx-auto w-full">
      {/* Top Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Candidate Profile</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              PHASE 2 MONGODB
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Define your academic background, target roles, current skill levels, and focus areas to personalize your AI preparation.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToChat}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 transition cursor-pointer"
        >
          ← Return to Chat
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs sm:text-sm text-emerald-300 flex items-center gap-3 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
            {activeUserId && (
              <p className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                Synced User ID: {activeUserId}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs sm:text-sm text-rose-300 flex items-center gap-3 shadow-md">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal & Education */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <User className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Personal & Academic Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="e.g. alex.rivera@example.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Degree</label>
              <input
                type="text"
                value={formData.degree}
                onChange={(e) => handleInputChange('degree', e.target.value)}
                placeholder="e.g. B.Tech Computer Science"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Specialization / Major</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => handleInputChange('specialization', e.target.value)}
                placeholder="e.g. Artificial Intelligence / Systems"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Experience Level</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => handleInputChange('experienceLevel', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="Student">Student (Pre-Final Year)</option>
                <option value="Final Year Student">Final Year Student</option>
                <option value="Fresher">Recent Graduate / Fresher</option>
                <option value="0-1 Years">Junior (0-1 Years Experience)</option>
                <option value="1-3 Years">Mid-Level (1-3 Years Experience)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">LeetCode / Coding Problems Solved</label>
              <input
                type="number"
                min="0"
                value={formData.leetcodeSolved}
                onChange={(e) => handleInputChange('leetcodeSolved', parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Career Targets */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <Target className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">Target Role & Companies</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Job Role</label>
              <input
                type="text"
                value={formData.targetRole}
                onChange={(e) => handleInputChange('targetRole', e.target.value)}
                placeholder="e.g. SDE-1, Data Scientist, ML Engineer"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Companies</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCompany();
                    }
                  }}
                  placeholder="e.g. Google, Amazon, Stripe"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleAddCompany}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-medium transition cursor-pointer"
                >
                  Add
                </button>
              </div>

              {/* Company Tags */}
              <div className="flex flex-wrap gap-1.5">
                {formData.targetCompanies.map((company, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                  >
                    {company}
                    <button
                      type="button"
                      onClick={() => handleRemoveCompany(company)}
                      className="hover:text-rose-400 text-slate-400 ml-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Technical Skills & Proficiency */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">Current Technical Skills</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Skill (e.g. Python, SQL, React, DSA)"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <select
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            <button
              type="button"
              onClick={handleAddSkill}
              className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill</span>
            </button>
          </div>

          {/* Skills List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            {formData.skills.map((skill, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-200">{skill.name}</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700/60">
                    {skill.level}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(index)}
                  className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                  title="Remove skill"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Weak Areas & Focus Topics */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">Weak Areas & Focus Priorities</h2>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newWeakArea}
              onChange={(e) => setNewWeakArea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddWeakArea();
                }
              }}
              placeholder="e.g. Dynamic Programming, System Design, Concurrency"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={handleAddWeakArea}
              className="px-4 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Add Focus
            </button>
          </div>

          {/* Weak areas chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {formData.weakAreas.map((area, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300"
              >
                {area}
                <button
                  type="button"
                  onClick={() => handleRemoveWeakArea(area)}
                  className="hover:text-rose-400 text-slate-400 ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading || !formData.name || !formData.email}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'Saving to Database...' : activeUserId ? 'Update Profile' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
