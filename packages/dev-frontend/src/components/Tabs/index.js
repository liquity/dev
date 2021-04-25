import cn from "classnames";

import classes from "./Tabs.module.css";

const Tab = ({ tab, setActiveTab, activeTab, content }) => (
  <div
    className={cn(classes.tab, {
      [classes.tabActive]: activeTab === tab
    })}
    onClick={() => setActiveTab(tab)}
  >
    {content}
  </div>
);

const Tabs = ({ setActiveTab, activeTab, tabs, className }) => (
  <div className={cn(classes.tabs, className)}>
    {tabs.map(t => (
      <Tab setActiveTab={() => setActiveTab(t.tab)} activeTab={activeTab} key={t.tab} {...t} />
    ))}
  </div>
);

export default Tabs;
