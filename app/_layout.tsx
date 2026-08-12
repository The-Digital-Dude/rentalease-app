import { Stack } from "expo-router";
import { ThemeProvider } from "../contexts/ThemeContext";
import React from "react";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function NotificationResponseListener() {
  const router = useRouter();

  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data: any = response?.notification?.request?.content?.data || {};
        const jobId = data.jobId || data.job_id || data.job?.id || data.job?._id;
        if (jobId) {
          router.push(`/job-details/${jobId}`);
        } else {
          router.push("/notifications");
        }
      }
    );
    return () => sub.remove();
  }, [router]);

  return null;
}

async function checkForUpdates() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (_) {}
}

export default function RootLayout() {
  React.useEffect(() => {
    checkForUpdates();
  }, []);

  return (
    <ThemeProvider>
      <NotificationResponseListener />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
