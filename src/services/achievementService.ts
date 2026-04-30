import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ACHIEVEMENTS } from '../constants/achievements';
import { ProgressSnapshot, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { toast } from 'sonner';

export async function checkAchievements(progress: ProgressSnapshot) {
  if (!auth.currentUser) return [];

  const newlyUnlocked: string[] = [];
  const currentUnlocked = progress.unlockedAchievements || [];

  for (const achievement of ACHIEVEMENTS) {
    if (currentUnlocked.includes(achievement.id)) continue;

    let met = false;
    switch (achievement.category) {
      case 'streak':
        // Calculate days from current progress or external logic
        // For simplicity, we assume 'streakData' carries the info or we use a separate field
        // Let's use longestStreak as a proxy for highest level reached
        if (progress.longestStreak >= achievement.requirement) met = true;
        break;
      case 'cravings':
        if (progress.cravingsResisted >= achievement.requirement) met = true;
        break;
      case 'tasks':
        if (progress.tasksCompletedTotal >= achievement.requirement) met = true;
        break;
      case 'social':
        // Social achievements usually triggered by actions themselves, but we can check counts if we had them
        break;
    }

    if (met) {
      newlyUnlocked.push(achievement.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    try {
      const progressRef = doc(db, 'progress', auth.currentUser.uid);
      await updateDoc(progressRef, {
        unlockedAchievements: arrayUnion(...newlyUnlocked)
      });
      
      // Notify for each new achievement
      newlyUnlocked.forEach(id => {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
          toast.success(`NEW UNLOCK: ${ach.title}`, {
            description: ach.description,
            icon: ach.icon,
            duration: 4000
          });
        }
      });

      return newlyUnlocked;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `progress/${auth.currentUser.uid}`);
    }
  }

  return [];
}

export async function unlockAchievement(achievementId: string) {
  if (!auth.currentUser) return false;
  
  try {
    const progressRef = doc(db, 'progress', auth.currentUser.uid);
    const snap = await getDoc(progressRef);
    if (snap.exists()) {
      const data = snap.data() as ProgressSnapshot;
      if (!data.unlockedAchievements?.includes(achievementId)) {
        await updateDoc(progressRef, {
          unlockedAchievements: arrayUnion(achievementId)
        });
        
        const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (ach) {
          toast.success(`PROTOCOL UNLOCKED: ${ach.title}`, {
            description: ach.description,
            icon: ach.icon,
            duration: 4000
          });
        }

        return true;
      }
    }
  } catch (error) {
    console.error("Failed to unlock achievement", error);
  }
  return false;
}
