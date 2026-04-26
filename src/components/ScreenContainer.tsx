import { View, type ViewProps } from "react-native";

import { useAppTheme } from "../theme/appTheme";

interface ScreenContainerProps extends ViewProps {
  maxWidth?: number;
}

export function ScreenContainer({ style, maxWidth = 960, ...props }: ScreenContainerProps) {
  const { spacing } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        {
          flex: 1,
          width: "100%",
          maxWidth,
          alignSelf: "center",
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}
    />
  );
}
