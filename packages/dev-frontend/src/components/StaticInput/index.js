import Row from "../Row";
import StaticAmounts from "../StaticAmounts";

const StaticInput = ({ label, unit, placeholder, color, children }) => (
  <Row label={label} unit={unit}>
    <StaticAmounts placeholder={placeholder} unit={unit} color={color} />
    {children}
  </Row>
);

export default StaticInput;
