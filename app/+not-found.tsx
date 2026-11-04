import { View } from 'react-native';
import { Empty, Header, toToday } from '../src/kit';
import { c } from '../src/theme';

// Any unknown link (old deep link, typo in a URL) lands here instead of Expo's "Unmatched Route" page.
export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Not found" onBack={toToday} />
      <View style={{ padding: 12 }}>
        <Empty icon="compass-outline" title="This page doesn't exist." action="Back to Today" onPress={toToday} />
      </View>
    </View>
  );
}
