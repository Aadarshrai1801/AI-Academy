import { useCallback, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { apiFetch, type QuestionDTO } from "./src/lib/api";

/**
 * Phase 7 mobile starter: daily board + one-question practice fetch.
 * Run: `npm install --prefix apps/mobile && npm start --prefix apps/mobile`
 * (Expo Go on a phone, same Wi-Fi as the API; set EXPO_PUBLIC_API_URL).
 */
export default function App() {
  const [token, setToken] = useState("");
  const [board, setBoard] = useState<Array<{ rank: number; userId: string; username: string; score: number }>>([]);
  const [question, setQuestion] = useState<QuestionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const r = await apiFetch<{ entries: Array<{ rank: number; userId: string; username: string; score: number }> }>(
        "/leaderboard/daily?limit=10",
      );
      setBoard(r.entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Board failed.");
    }
  }, []);

  const nextQuestion = useCallback(async () => {
    try {
      const q = await apiFetch<QuestionDTO>("/questions/next", token || undefined);
      setQuestion(q);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Practice needs sign-in (token above) + quota.");
    }
  }, [token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hoopr (mobile preview)</Text>
      <TextInput
        style={styles.input}
        placeholder="Clerk session token (for practice)"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <Button title="Board" onPress={loadBoard} />
        <Button title="Next question" onPress={nextQuestion} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView style={styles.list}>
        {board.map((r) => (
          <Text key={r.userId + r.rank} style={styles.row2}>
            #{r.rank} {r.username} — {r.score} pts
          </Text>
        ))}
        {question ? (
          <View style={styles.card}>
            <Text style={styles.q}>{question.prompt}</Text>
            {(question.options ?? []).map((o) => (
              <Text key={o} style={styles.opt}>
                • {o}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingHorizontal: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 10, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  row2: { fontSize: 15, paddingVertical: 6 },
  error: { color: "#b91c1c", marginBottom: 8 },
  list: { flex: 1 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, marginTop: 10 },
  q: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  opt: { fontSize: 14, paddingVertical: 2 },
});
