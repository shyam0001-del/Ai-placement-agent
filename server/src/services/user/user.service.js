import mongoose from 'mongoose';
import { User } from '../../models/user.model.js';
import { isDatabaseConnected } from '../../config/db.js';

// In-memory fallback repository for offline/test mode when MongoDB is unavailable
const memoryUsers = new Map();

/**
 * Format a user profile into a clean, concise string for LLM context (Section 6)
 * Avoids dumping raw MongoDB internals into the prompt.
 * @param {Object} user
 * @returns {string}
 */
export function formatProfileContext(user) {
  if (!user) return '';

  const skillsStr = Array.isArray(user.skills) && user.skills.length > 0
    ? user.skills.map((s) => `${s.name}${s.level ? ` (${s.level})` : ''}`).join(', ')
    : 'Not specified';

  const companiesStr = Array.isArray(user.targetCompanies) && user.targetCompanies.length > 0
    ? user.targetCompanies.join(', ')
    : 'Not specified';

  const weakAreasStr = Array.isArray(user.weakAreas) && user.weakAreas.length > 0
    ? user.weakAreas.join(', ')
    : 'None highlighted yet';

  return [
    'Candidate Profile Context:',
    `- Name: ${user.name || 'Candidate'}`,
    user.degree ? `- Degree: ${user.degree}${user.specialization ? ` (${user.specialization})` : ''}` : null,
    `- Experience Level: ${user.experienceLevel || 'Student'}`,
    `- Target Role: ${user.targetRole || 'Not specified'}`,
    `- Target Companies: ${companiesStr}`,
    `- Current Skills: ${skillsStr}`,
    `- Weak Areas / Focus Needed: ${weakAreasStr}`,
    typeof user.leetcodeSolved === 'number' && user.leetcodeSolved > 0
      ? `- LeetCode Problems Solved: ${user.leetcodeSolved}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

class UserService {
  /**
   * Create a new user profile
   */
  async createUser(userData) {
    if (isDatabaseConnected()) {
      const user = new User(userData);
      await user.save();
      return user.toJSON();
    }

    // In-memory fallback for testing or offline database
    const fakeId = new mongoose.Types.ObjectId().toString();
    const newUser = {
      id: fakeId,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryUsers.set(fakeId, newUser);
    return newUser;
  }

  /**
   * Find user profile by ID
   */
  async getUserById(id) {
    if (!id) return null;

    if (isDatabaseConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      const user = await User.findById(id);
      return user ? user.toJSON() : null;
    }

    // In-memory fallback
    return memoryUsers.get(id) || null;
  }

  /**
   * Update an existing user profile
   */
  async updateUser(id, updateData) {
    if (!id) return null;

    if (isDatabaseConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      const user = await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      return user ? user.toJSON() : null;
    }

    // In-memory fallback
    const existing = memoryUsers.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date(),
    };
    memoryUsers.set(id, updated);
    return updated;
  }

  /**
   * Delete a user profile by ID
   */
  async deleteUser(id) {
    if (!id) return false;

    if (isDatabaseConnected()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }
      const result = await User.findByIdAndDelete(id);
      return Boolean(result);
    }

    // In-memory fallback
    return memoryUsers.delete(id);
  }

  /**
   * Clear in-memory users (for test isolation)
   */
  clearMemory() {
    memoryUsers.clear();
  }
}

export const userService = new UserService();
